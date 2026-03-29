function roundToTwoDecimals(value) {
  return Math.round(value * 100) / 100;
}

function calculateTargetNetPricing() {
  const targetNetAmount = Number(process.env.TARGET_NET_AMOUNT_INR || 20000);
  const gstRate = Number(process.env.GST_RATE || 0.18);
  const platformFeeRate = Number(process.env.PLATFORM_FEE_RATE || 0);
  const platformFeeFixed = Number(process.env.PLATFORM_FEE_FIXED_INR || 0);

  if (platformFeeRate >= 1) {
    throw new Error("PLATFORM_FEE_RATE must be lower than 1");
  }

  const taxableBase = roundToTwoDecimals((targetNetAmount + platformFeeFixed) / (1 - platformFeeRate));
  const platformCharge = roundToTwoDecimals(taxableBase * platformFeeRate + platformFeeFixed);
  const gstAmount = roundToTwoDecimals(taxableBase * gstRate);
  const totalAmount = roundToTwoDecimals(taxableBase + gstAmount);

  return {
    baseAmount: taxableBase,
    gstRate,
    gstAmount,
    platformCharge,
    totalAmount,
    targetNetAmount,
    pricingMode: "target-net",
  };
}

function calculateAddOnPricing() {
  const baseAmount = Number(process.env.BASE_FEE_INR || 20000);
  const gstRate = Number(process.env.GST_RATE || 0.18);
  const platformCharge = Number(process.env.PLATFORM_CHARGE_INR || 0);

  const gstAmount = roundToTwoDecimals(baseAmount * gstRate);
  const totalAmount = roundToTwoDecimals(baseAmount + gstAmount + platformCharge);

  return {
    baseAmount,
    gstRate,
    gstAmount,
    platformCharge,
    totalAmount,
    pricingMode: "add-on",
  };
}

function calculatePricing() {
  const pricingMode = String(process.env.PRICING_MODE || "add-on").toLowerCase();

  if (pricingMode === "target-net") {
    return calculateTargetNetPricing();
  }

  return calculateAddOnPricing();
}

module.exports = {
  calculatePricing,
};
