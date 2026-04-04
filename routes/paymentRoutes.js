const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const multer = require("multer");

const Registration = require("../models/Registration");
const User = require("../models/User");
const authMiddleware = require("../middleware/auth");
const adminMiddleware = require("../middleware/admin");
const {
  sendRegistrationSubmissionAcknowledgement,
  sendPaymentVerifiedEmail,
} = require("../services/emailService");

const router = express.Router();
const PAY_ROUTE_ALIASES = {
  instructions: ["/n4p-zk/f0", "/funds/info", "/payments/instructions"],
  uploadProof: ["/n4p-zk/f1/:registrationId", "/funds/proof/:registrationId", "/payments/upload-proof/:registrationId"],
  status: ["/n4p-zk/f2/:registrationId", "/funds/state/:registrationId", "/payments/status/:registrationId"],
  proofDownload: ["/n4p-zk/f3/:registrationId", "/funds/file/:registrationId", "/payments/proof/:registrationId/download"],
  adminList: ["/n4p-zk/f4", "/ops/list", "/admin/registrations"],
  adminApprove: ["/n4p-zk/f5/:registrationId", "/ops/approve/:registrationId", "/admin/registrations/:registrationId/verify-payment"],
};

const projectRoot = path.join(__dirname, "..");
const proofDirectory = path.join(projectRoot, "uploads", "payment-proofs");
fs.mkdirSync(proofDirectory, { recursive: true });

const maxProofSizeBytes = Number(process.env.MAX_PROOF_SIZE_MB || 10) * 1024 * 1024;
const allowedMimeTypes = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, proofDirectory);
  },
  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname || "").toLowerCase() || ".bin";
    const safeName = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${extension}`;
    callback(null, safeName);
  },
});

const proofUploader = multer({
  storage,
  limits: {
    fileSize: maxProofSizeBytes,
  },
  fileFilter: (_req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      return callback(new Error("Only PDF, PNG, JPG, JPEG, and WEBP files are allowed"));
    }
    return callback(null, true);
  },
}).single("paymentProof");

function runProofUpload(req, res) {
  return new Promise((resolve, reject) => {
    proofUploader(req, res, (error) => {
      if (error) {
        return reject(error);
      }
      return resolve();
    });
  });
}

function getBankDetails() {
  return {
    accountName: process.env.BANK_ACCOUNT_NAME || "",
    accountNumber: process.env.BANK_ACCOUNT_NUMBER || "",
    ifsc: process.env.BANK_IFSC || "",
    bankName: process.env.BANK_NAME || "",
    branch: process.env.BANK_BRANCH || "",
    upiId: process.env.BANK_UPI_ID || "",
    instructions:
      process.env.BANK_PAYMENT_INSTRUCTIONS ||
      "Transfer the amount to the account shown and upload payment proof for manual verification.",
  };
}

async function canAccessRegistrationProof(registration, requesterId) {
  if (String(registration.user) === String(requesterId)) {
    return true;
  }

  const user = await User.findById(requesterId).select("role");
  return user?.role === "admin";
}

router.get(PAY_ROUTE_ALIASES.instructions, authMiddleware, (_req, res) => {
  return res.json({ bankDetails: getBankDetails() });
});

router.post(PAY_ROUTE_ALIASES.uploadProof, authMiddleware, async (req, res, next) => {
  try {
    await runProofUpload(req, res);

    if (!req.file) {
      return res.status(400).json({ message: "Payment proof file is required" });
    }

    const registration = await Registration.findOne({
      _id: req.params.registrationId,
      user: req.user.sub,
    });

    if (!registration) {
      return res.status(404).json({ message: "Registration not found" });
    }

    const transactionId = String(req.body?.transactionId || "").trim();
    const billingAddress = String(req.body?.billingAddress || "").trim();
    const paymentDateRaw = String(req.body?.paymentDate || "").trim();
    const paymentDate = paymentDateRaw ? new Date(paymentDateRaw) : null;

    if (!transactionId) {
      return res.status(400).json({ message: "Transaction ID is required" });
    }

    if (!billingAddress) {
      return res.status(400).json({ message: "Billing address is required" });
    }

    if (!paymentDate || Number.isNaN(paymentDate.getTime())) {
      return res.status(400).json({ message: "Valid payment date is required" });
    }

    if (registration.status === "PAYMENT_VERIFIED") {
      return res.status(400).json({ message: "Payment is already verified for this registration" });
    }

    registration.payment = {
      ...registration.payment,
      method: "BANK_TRANSFER",
      state: "PROOF_UPLOADED",
      transactionId,
      billingAddress,
      paymentDate,
      submittedAt: new Date(),
      proof: {
        fileName: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        relativePath: path.relative(projectRoot, req.file.path).split(path.sep).join("/"),
        uploadedAt: new Date(),
      },
    };
    registration.status = "UNDER_REVIEW";

    if (!registration.registrationAcknowledgementEmailSent) {
      const user = await User.findById(registration.user);
      if (user) {
        await sendRegistrationSubmissionAcknowledgement({
          to: user.email,
          userName: user.name,
          registration,
        });
        registration.registrationAcknowledgementEmailSent = true;
      }
    }

    await registration.save();

    return res.json({
      message: "Payment proof uploaded successfully",
      registration,
    });
  } catch (error) {
    return next(error);
  }
});

router.get(PAY_ROUTE_ALIASES.status, authMiddleware, async (req, res, next) => {
  try {
    const registration = await Registration.findOne({
      _id: req.params.registrationId,
      user: req.user.sub,
    });

    if (!registration) {
      return res.status(404).json({ message: "Registration not found" });
    }

    return res.json({ registration });
  } catch (error) {
    return next(error);
  }
});

router.get(PAY_ROUTE_ALIASES.proofDownload, authMiddleware, async (req, res, next) => {
  try {
    const registration = await Registration.findById(req.params.registrationId);
    if (!registration) {
      return res.status(404).json({ message: "Registration not found" });
    }

    const allowed = await canAccessRegistrationProof(registration, req.user.sub);
    if (!allowed) {
      return res.status(403).json({ message: "You do not have access to this file" });
    }

    const relativePath = registration.payment?.proof?.relativePath;
    if (!relativePath) {
      return res.status(404).json({ message: "Payment proof is not uploaded yet" });
    }

    const absolutePath = path.join(projectRoot, relativePath);
    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ message: "Stored proof file was not found" });
    }

    return res.download(absolutePath, registration.payment?.proof?.originalName || registration.payment?.proof?.fileName);
  } catch (error) {
    return next(error);
  }
});

router.get(PAY_ROUTE_ALIASES.adminList, authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const { status } = req.query;
    const filter = {};

    if (status) {
      filter.status = status;
    }

    const registrations = await Registration.find(filter)
      .populate("user", "name email role")
      .populate("payment.verifiedBy", "name email")
      .sort({ createdAt: -1 });

    return res.json({
      registrations,
      bankDetails: getBankDetails(),
    });
  } catch (error) {
    return next(error);
  }
});

router.post(PAY_ROUTE_ALIASES.adminApprove, authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const registration = await Registration.findById(req.params.registrationId).populate("user", "name email");

    if (!registration) {
      return res.status(404).json({ message: "Registration not found" });
    }

    if (!registration.payment?.proof?.relativePath) {
      return res.status(400).json({ message: "Payment proof has not been uploaded" });
    }

    if (registration.status === "PAYMENT_VERIFIED") {
      return res.status(400).json({ message: "Payment is already verified" });
    }

    registration.status = "PAYMENT_VERIFIED";
    // Update nested fields directly so existing payment.proof metadata is preserved.
    registration.payment.state = "VERIFIED";
    registration.payment.paidAt = registration.payment?.paidAt || new Date();
    registration.payment.verifiedAt = new Date();
    registration.payment.verifiedBy = req.admin._id;
    registration.payment.adminRemark = String(req.body?.remark || "").trim();

    if (!registration.paymentVerifiedEmailSent && registration.user?.email) {
      await sendPaymentVerifiedEmail({
        to: registration.user.email,
        userName: registration.user.name,
        registration,
      });
      registration.paymentVerifiedEmailSent = true;
    }

    await registration.save();

    return res.json({
      message: "Payment verified successfully",
      registration,
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
