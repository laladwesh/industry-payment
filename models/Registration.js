const mongoose = require("mongoose");

const attendeeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      default: "",
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    organization: {
      type: String,
      trim: true,
      default: "",
    },
    designation: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { _id: false }
);

const representativeSchema = new mongoose.Schema(
  {
    companyName: {
      type: String,
      trim: true,
      default: "",
    },
    personName: {
      type: String,
      trim: true,
      default: "",
    },
    designation: {
      type: String,
      trim: true,
      default: "",
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    contact: {
      type: String,
      trim: true,
      default: "",
    },
    companyProfile: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { _id: false }
);

const registrationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    attendeeCount: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    attendees: {
      type: [attendeeSchema],
      default: [],
      validate: {
        validator(value) {
          return value.length <= 5;
        },
        message: "Maximum 5 attendee entries are allowed",
      },
    },
    representative: {
      type: representativeSchema,
      default: () => ({}),
    },
    amount: {
      baseAmount: { type: Number, required: true },
      gstRate: { type: Number, required: true },
      gstAmount: { type: Number, required: true },
      platformCharge: { type: Number, required: true },
      totalAmount: { type: Number, required: true },
    },
    status: {
      type: String,
      enum: [
        "PENDING_PROOF",
        "UNDER_REVIEW",
        "PAYMENT_VERIFIED",
        "PENDING_PAYMENT",
        "PAYMENT_PENDING",
        "REGISTERED",
        "PAYMENT_FAILED",
      ],
      default: "PENDING_PROOF",
    },
    payment: {
      method: { type: String, default: "BANK_TRANSFER" },
      merchantTransactionId: { type: String, default: null },
      providerTransactionId: { type: String, default: null },
      transactionId: { type: String, default: null },
      state: { type: String, default: null },
      responseCode: { type: String, default: null },
      rawResponse: { type: mongoose.Schema.Types.Mixed, default: null },
      billingAddress: { type: String, default: "" },
      paymentDate: { type: Date, default: null },
      paidAt: { type: Date, default: null },
      submittedAt: { type: Date, default: null },
      verifiedAt: { type: Date, default: null },
      verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      adminRemark: { type: String, default: "" },
      proof: {
        fileName: { type: String, default: null },
        originalName: { type: String, default: null },
        mimeType: { type: String, default: null },
        size: { type: Number, default: null },
        relativePath: { type: String, default: null },
        uploadedAt: { type: Date, default: null },
      },
    },
    registrationAcknowledgementEmailSent: {
      type: Boolean,
      default: false,
    },
    paymentVerifiedEmailSent: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Registration", registrationSchema);
