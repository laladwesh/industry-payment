const mongoose = require("mongoose");

const registrationConfigSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: "registration-config",
    },
    maxRegistrations: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("RegistrationConfig", registrationConfigSchema);
