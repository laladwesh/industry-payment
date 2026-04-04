const express = require("express");

const Registration = require("../models/Registration");
const RegistrationConfig = require("../models/RegistrationConfig");
const adminMiddleware = require("../middleware/admin");
const authMiddleware = require("../middleware/auth");
const { calculatePricing } = require("../utils/pricing");

const router = express.Router();
const REG_ROUTE_ALIASES = {
  create: ["/v7m-qr/r0", "/flow/start", "/registrations"],
  me: ["/v7m-qr/r1", "/flow/self", "/registrations/me"],
  byId: ["/v7m-qr/r2/:registrationId", "/flow/item/:registrationId", "/registrations/:registrationId"],
  attendees: ["/v7m-qr/r3/:registrationId", "/flow/item/:registrationId/people", "/registrations/:registrationId/attendees"],
  limitGet: ["/v7m-qr/r4", "/ops/cap", "/admin/registration-limit"],
  limitPut: ["/v7m-qr/r4", "/ops/cap", "/admin/registration-limit"],
};

const REGISTRATION_CONFIG_KEY = "registration-config";

async function getRegistrationConfig() {
  const envDefault = Math.max(0, Number(process.env.MAX_REGISTRATIONS || 0));
  return RegistrationConfig.findOneAndUpdate(
    { key: REGISTRATION_CONFIG_KEY },
    {
      $setOnInsert: {
        key: REGISTRATION_CONFIG_KEY,
        maxRegistrations: envDefault,
      },
    },
    { upsert: true, new: true }
  );
}

function normalizeRepresentative(input) {
  return {
    companyName: String(input?.companyName || "").trim(),
    personName: String(input?.personName || "").trim(),
    designation: String(input?.designation || "").trim(),
    email: String(input?.email || "")
      .trim()
      .toLowerCase(),
    contact: String(input?.contact || "").trim(),
    companyProfile: String(input?.companyProfile || "").trim(),
  };
}

function validateRepresentative(representative) {
  if (!representative.companyName) {
    return "Company name is required";
  }
  if (!representative.personName) {
    return "Person name is required";
  }
  if (!representative.designation) {
    return "Designation is required";
  }
  if (!representative.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(representative.email)) {
    return "Valid email is required";
  }
  if (!representative.contact) {
    return "Contact number is required";
  }
  if (!representative.companyProfile) {
    return "Company profile is required";
  }
  return null;
}

router.post(REG_ROUTE_ALIASES.create, authMiddleware, async (req, res, next) => {
  try {
    const existingRegistration = await Registration.findOne({ user: req.user.sub });
    if (existingRegistration) {
      return res.status(409).json({
        message: "Only one registration is allowed per account.",
        registration: existingRegistration,
      });
    }

    const config = await getRegistrationConfig();
    if (config.maxRegistrations > 0) {
      const totalRegistrations = await Registration.countDocuments();
      if (totalRegistrations >= config.maxRegistrations) {
        return res.status(403).json({
          message: "Registration is closed. Maximum registration limit has been reached.",
          limit: config.maxRegistrations,
          currentCount: totalRegistrations,
        });
      }
    }

    const attendeeCount = Number(req.body.attendeeCount);
    const inputAttendees = Array.isArray(req.body.attendees) ? req.body.attendees : [];
    const representative = normalizeRepresentative(req.body.representative);
    const hasConclaveInterestConsent = req.body?.conclaveInterestConfirmed === true;

    if (!hasConclaveInterestConsent) {
      return res.status(400).json({
        message: "Please confirm interest in the conclave and willingness to pay registration fees.",
      });
    }

    const representativeError = validateRepresentative(representative);
    if (representativeError) {
      return res.status(400).json({ message: representativeError });
    }

    if (!Number.isInteger(attendeeCount) || attendeeCount < 1 || attendeeCount > 5) {
      return res.status(400).json({ message: "Attendee count should be between 1 and 5" });
    }

    const attendees = inputAttendees.slice(0, attendeeCount).map((attendee) => ({
      name: String(attendee?.name || "").trim(),
      email: String(attendee?.email || "").trim().toLowerCase(),
      phone: String(attendee?.phone || "").trim(),
      organization: String(attendee?.organization || "").trim(),
      designation: String(attendee?.designation || "").trim(),
    }));

    const pricing = calculatePricing();

    const registration = await Registration.create({
      user: req.user.sub,
      attendeeCount,
      attendees,
      representative,
      amount: {
        baseAmount: pricing.baseAmount,
        gstRate: pricing.gstRate,
        gstAmount: pricing.gstAmount,
        platformCharge: pricing.platformCharge,
        totalAmount: pricing.totalAmount,
      },
      status: "PENDING_PROOF",
      payment: {
        method: "BANK_TRANSFER",
        state: "PENDING_PROOF",
      },
    });

    return res.status(201).json({ registration });
  } catch (error) {
    return next(error);
  }
});

router.get(REG_ROUTE_ALIASES.me, authMiddleware, async (req, res, next) => {
  try {
    const registrations = await Registration.find({ user: req.user.sub }).sort({ createdAt: -1 });
    return res.json({ registrations });
  } catch (error) {
    return next(error);
  }
});

router.get(REG_ROUTE_ALIASES.byId, authMiddleware, async (req, res, next) => {
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

router.patch(REG_ROUTE_ALIASES.attendees, authMiddleware, async (req, res, next) => {
  try {
    const registration = await Registration.findOne({
      _id: req.params.registrationId,
      user: req.user.sub,
    });

    if (!registration) {
      return res.status(404).json({ message: "Registration not found" });
    }

    const inputAttendees = Array.isArray(req.body.attendees) ? req.body.attendees : [];
    const attendeeCount = Number(registration.attendeeCount || 0);

    const attendees = Array.from({ length: attendeeCount }, (_, index) => {
      const previous = registration.attendees?.[index] || {};
      const incoming = inputAttendees[index] || {};

      return {
        name: String(incoming.name ?? previous.name ?? "").trim(),
        email: String(incoming.email ?? previous.email ?? "")
          .trim()
          .toLowerCase(),
        phone: String(incoming.phone ?? previous.phone ?? "").trim(),
        organization: String(incoming.organization ?? previous.organization ?? "").trim(),
        designation: String(incoming.designation ?? previous.designation ?? "").trim(),
      };
    });

    registration.attendees = attendees;
    await registration.save();

    return res.json({
      message: "Participant details updated successfully",
      registration,
    });
  } catch (error) {
    return next(error);
  }
});

router.get(REG_ROUTE_ALIASES.limitGet, authMiddleware, adminMiddleware, async (_req, res, next) => {
  try {
    const config = await getRegistrationConfig();
    const currentCount = await Registration.countDocuments();

    return res.json({
      maxRegistrations: config.maxRegistrations,
      currentCount,
      closed: config.maxRegistrations > 0 && currentCount >= config.maxRegistrations,
    });
  } catch (error) {
    return next(error);
  }
});

router.put(REG_ROUTE_ALIASES.limitPut, authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const nextLimit = Number(req.body?.maxRegistrations);
    if (!Number.isInteger(nextLimit) || nextLimit < 0) {
      return res.status(400).json({ message: "maxRegistrations must be a non-negative integer" });
    }

    const config = await RegistrationConfig.findOneAndUpdate(
      { key: REGISTRATION_CONFIG_KEY },
      { $set: { maxRegistrations: nextLimit } },
      { upsert: true, new: true }
    );

    const currentCount = await Registration.countDocuments();
    return res.json({
      message: "Registration limit updated successfully",
      maxRegistrations: config.maxRegistrations,
      currentCount,
      closed: config.maxRegistrations > 0 && currentCount >= config.maxRegistrations,
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
