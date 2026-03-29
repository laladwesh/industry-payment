function getAdminEmailSet() {
  const raw = String(process.env.ADMIN_EMAILS || "");
  return new Set(
    raw
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean)
  );
}

function isAdminEmail(email) {
  if (!email) {
    return false;
  }

  return getAdminEmailSet().has(String(email).toLowerCase().trim());
}

function resolveRoleForEmail(email) {
  return isAdminEmail(email) ? "admin" : "user";
}

module.exports = {
  isAdminEmail,
  resolveRoleForEmail,
};
