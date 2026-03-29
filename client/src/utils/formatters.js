export function formatMoney(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));
}

export function formatStatus(status) {
  const map = {
    PENDING_PROOF: "Payment Pending",
    UNDER_REVIEW: "Under Review",
    PAYMENT_VERIFIED: "Payment Verified",
  };
  return map[status] || status;
}

export function statusClass(status) {
  if (status === "PAYMENT_VERIFIED") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status === "UNDER_REVIEW") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  return "border-slate-200 bg-slate-50 text-slate-700";
}

export function getDownloadFileName(registration) {
  const name = registration?.payment?.proof?.originalName;
  if (name) {
    return name;
  }
  return `payment-proof-${registration?._id || "file"}`;
}
