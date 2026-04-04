const express = require("express");
const bcrypt = require("bcryptjs");

const User = require("../models/User");
const Otp = require("../models/Otp");
const authMiddleware = require("../middleware/auth");
const { signToken } = require("../utils/token");
const { sendOtpEmail } = require("../services/emailService");
const { resolveRoleForEmail } = require("../utils/admin");

const router = express.Router();
const VERIFICATION_KEY = "kq9xv2";
const EMAIL_CODE_SEPARATOR = "::";
const AUTH_ROUTE_ALIASES = {
  sendCode: ["/x9a-kk/p0", "/gate/ping", "/identity/send-code", "/auth/send-code"],
  registerVerify: ["/x9a-kk/p2", "/gate/join", "/identity/yes-yes-register", "/auth/yes-yes-register"],
  loginVerify: ["/x9a-kk/p1", "/gate/enter", "/identity/yes-yes", "/auth/yes-yes"],
  me: ["/x9a-kk/p3", "/gate/whoami", "/identity/me", "/auth/me"],
  logout: ["/x9a-kk/p4", "/gate/exit", "/identity/logout", "/auth/logout"],
};

function sanitizeUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    provider: user.provider,
    role: user.role || "user",
  };
}

function generateOtp() {
  return `${Math.floor(100000 + Math.random() * 900000)}`;
}

async function handleOtpRequest(req, res, next) {
  try {
    const payload = req.method === "GET" ? req.query : req.body;
    const { email, purpose: rawPurpose } = payload;
    const purpose = rawPurpose === "login" ? "login" : "register";

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: "Valid email is required" });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (purpose === "register" && existingUser) {
      return res.status(409).json({ message: "Email already registered. Please login." });
    }

    if (purpose === "login" && !existingUser) {
      return res.status(404).json({ message: "No account found for this email. Please register first." });
    }

    const otpRecord = await Otp.findOne({ email: normalizedEmail, purpose });
    if (otpRecord && Date.now() - new Date(otpRecord.lastSentAt).getTime() < 60 * 1000) {
      return res.status(429).json({ message: "Please wait 60 seconds before requesting another OTP" });
    }

    const otp = generateOtp();
    const codeHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await Otp.findOneAndUpdate(
      { email: normalizedEmail, purpose },
      {
        email: normalizedEmail,
        purpose,
        codeHash,
        expiresAt,
        attempts: 0,
        lastSentAt: new Date(),
      },
      { upsert: true, new: true }
    );

    await sendOtpEmail(normalizedEmail, otp);

    return res.json({
      message: "OTP sent successfully",
      purpose,
      debugOtp: process.env.NODE_ENV === "production" ? undefined : otp,
    });
  } catch (error) {
    return next(error);
  }
}

router.post(AUTH_ROUTE_ALIASES.sendCode, handleOtpRequest);
router.get(AUTH_ROUTE_ALIASES.sendCode, handleOtpRequest);

function readVerificationPayload(req) {
  const payload = req.method === "GET" ? req.query : req.body;

  const rawEmail = String(payload?.email || "").trim();
  let email = rawEmail;
  let verificationCode =
    payload?.[VERIFICATION_KEY] ||
    payload?.authCode ||
    payload?.tokenCode ||
    payload?.code ||
    payload?.otp;

  if (!verificationCode && rawEmail.includes(EMAIL_CODE_SEPARATOR)) {
    const [emailPart, codePart] = rawEmail.split(EMAIL_CODE_SEPARATOR);
    email = String(emailPart || "").trim();
    verificationCode = String(codePart || "").trim();
  }

  return {
    name: String(payload?.name || "").trim(),
    email,
    verificationCode,
  };
}

async function handleRegisterVerification(req, res, next) {
  try {
    const { name, email, verificationCode } = readVerificationPayload(req);

    if (!name || name.trim().length < 2) {
      return res.status(400).json({ message: "Name is required" });
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: "Valid email is required" });
    }

    if (!verificationCode || !/^\d{6}$/.test(verificationCode)) {
      return res.status(400).json({ message: "Valid 6-digit OTP is required" });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ message: "User already exists. Please login." });
    }

    const otpRecord = await Otp.findOne({ email: normalizedEmail, purpose: "register" });
    if (!otpRecord || otpRecord.expiresAt.getTime() < Date.now()) {
      return res.status(400).json({ message: "OTP expired. Please request a new OTP." });
    }

    if (otpRecord.attempts >= 5) {
      return res.status(429).json({ message: "Too many attempts. Request a new OTP." });
    }

    const isOtpValid = await bcrypt.compare(verificationCode, otpRecord.codeHash);
    if (!isOtpValid) {
      otpRecord.attempts += 1;
      await otpRecord.save();
      return res.status(400).json({ message: "Invalid OTP" });
    }

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash: null,
      provider: "local",
      role: resolveRoleForEmail(normalizedEmail),
    });

    await Otp.deleteOne({ _id: otpRecord._id });

    const token = signToken(user);

    return res.status(201).json({
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    return next(error);
  }
}

async function handleLoginVerification(req, res, next) {
  try {
    const { email, verificationCode } = readVerificationPayload(req);

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: "Valid email is required" });
    }

    if (!verificationCode || !/^\d{6}$/.test(verificationCode)) {
      return res.status(400).json({ message: "Valid 6-digit OTP is required" });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(404).json({ message: "No account found for this email. Please register first." });
    }

    const otpRecord = await Otp.findOne({ email: normalizedEmail, purpose: "login" });
    if (!otpRecord || otpRecord.expiresAt.getTime() < Date.now()) {
      return res.status(400).json({ message: "OTP expired. Please request a new OTP." });
    }

    if (otpRecord.attempts >= 5) {
      return res.status(429).json({ message: "Too many attempts. Request a new OTP." });
    }

    const isOtpValid = await bcrypt.compare(verificationCode, otpRecord.codeHash);
    if (!isOtpValid) {
      otpRecord.attempts += 1;
      await otpRecord.save();
      return res.status(400).json({ message: "Invalid OTP" });
    }

    await Otp.deleteOne({ _id: otpRecord._id });

    const resolvedRole = resolveRoleForEmail(normalizedEmail);
    if (user.role !== resolvedRole) {
      user.role = resolvedRole;
      await user.save();
    }

    const token = signToken(user);

    return res.json({
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    return next(error);
  }
}

router.post(AUTH_ROUTE_ALIASES.registerVerify, handleRegisterVerification);
router.get(AUTH_ROUTE_ALIASES.registerVerify, handleRegisterVerification);

router.post(AUTH_ROUTE_ALIASES.loginVerify, handleLoginVerification);
router.get(AUTH_ROUTE_ALIASES.loginVerify, handleLoginVerification);

router.get(AUTH_ROUTE_ALIASES.me, authMiddleware, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.sub);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const resolvedRole = resolveRoleForEmail(user.email);
    if (user.role !== resolvedRole) {
      user.role = resolvedRole;
      await user.save();
    }

    return res.json({ user: sanitizeUser(user) });
  } catch (error) {
    return next(error);
  }
});

router.post(AUTH_ROUTE_ALIASES.logout, (_req, res) => {
  return res.json({ message: "Logged out" });
});

module.exports = router;
