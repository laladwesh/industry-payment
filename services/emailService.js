const nodemailer = require("nodemailer");

let transporter;
let warnedMissingConfig = false;

function maskEmail(email) {
  const value = String(email || "").trim();
  const [local, domain] = value.split("@");
  if (!local || !domain) {
    return value;
  }
  if (local.length <= 2) {
    return `${local[0] || "*"}***@${domain}`;
  }
  return `${local.slice(0, 2)}***@${domain}`;
}

function getLastFiveId(value) {
  const text = String(value || "");
  return text.slice(-5) || text;
}

function getTransporter() {
  if (transporter) {
    return transporter;
  }

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    if (!warnedMissingConfig) {
      console.warn("SMTP credentials are not set. Emails will be skipped.", {
        hasHost: Boolean(host),
        hasUser: Boolean(user),
        hasPass: Boolean(pass),
      });
      warnedMissingConfig = true;
    }
    return null;
  }

  console.log("[mail] Initializing transporter", {
    host,
    port,
    secure: port === 465,
    user: maskEmail(user),
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
  });

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
  });

  return transporter;
}

async function sendMail({ to, subject, html }) {
  const activeTransporter = getTransporter();
  if (!activeTransporter) {
    return { sent: false, skipped: true };
  }

  const payload = {
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    html,
  };

  console.log("[mail] Sending email", {
    to: maskEmail(to),
    subject,
    from: payload.from,
  });

  try {
    const info = await activeTransporter.sendMail(payload);
    console.log("[mail] Email sent", {
      to: maskEmail(to),
      subject,
      messageId: info.messageId,
      response: info.response,
    });
    return { sent: true, messageId: info.messageId };
  } catch (error) {
    console.error("[mail] Email send failed", {
      to: maskEmail(to),
      subject,
      from: payload.from,
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT || 587) === 465,
      error: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
    });
    throw error;
  }
}

async function sendOtpEmail(to, otp) {
  const html = `
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
      <h2 style="margin-bottom: 8px;">Industry Conclave IIT Guwahati - OTP Verification</h2>
      <p>Your OTP for account verification is:</p>
      <p style="font-size: 28px; font-weight: 700; letter-spacing: 2px;">${otp}</p>
      <p>This OTP is valid for 10 minutes.</p>
      <p>If you did not request this, you can safely ignore this email.</p>
    </div>
  `;

  return sendMail({
    to,
    subject: "Your OTP for Industry Conclave Registration",
    html,
  });
}

async function sendRegistrationSubmissionAcknowledgement({ to, userName, registration }) {
  const registrationRef = getLastFiveId(registration?._id);
  const html = `
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
      <h2 style="margin-bottom: 8px;">Registration Submitted - Industry Conclave IIT Guwahati</h2>
      <p>Dear ${userName || "Participant"},</p>
      <p>We have received your registration and payment proof for Industry Conclave at IIT Guwahati (12-14 May 2026).</p>
      <ul>
        <li><strong>Registration Ref (Last 5):</strong> ${registrationRef}</li>
        <li><strong>Attendee Count:</strong> ${registration.attendeeCount}</li>
        <li><strong>Amount Expected:</strong> INR ${registration.amount.totalAmount}</li>
        <li><strong>Status:</strong> Under review by admin</li>
      </ul>
      <p>Your registration is currently pending manual verification. We will inform you once it is verified.</p>
    </div>
  `;

  return sendMail({
    to,
    subject: "Registration Received - Verification Pending",
    html,
  });
}

async function sendPaymentVerifiedEmail({ to, userName, registration }) {
  const registrationRef = getLastFiveId(registration?._id);
  const html = `
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
      <h2 style="margin-bottom: 8px;">Payment Verified - Industry Conclave IIT Guwahati</h2>
      <p>Dear ${userName || "Participant"},</p>
      <p>Your payment has been verified successfully by the admin team.</p>
      <ul>
        <li><strong>Registration Ref (Last 5):</strong> ${registrationRef}</li>
        <li><strong>Attendee Count:</strong> ${registration.attendeeCount}</li>
        <li><strong>Amount Received:</strong> INR ${registration.amount.totalAmount}</li>
        <li><strong>Status:</strong> Payment Verified</li>
      </ul>
      <p>Thank you for registering. We look forward to seeing you at IIT Guwahati.</p>
    </div>
  `;

  return sendMail({
    to,
    subject: "Payment Verified - Industry Conclave IITG",
    html,
  });
}

module.exports = {
  sendOtpEmail,
  sendRegistrationSubmissionAcknowledgement,
  sendPaymentVerifiedEmail,
};
