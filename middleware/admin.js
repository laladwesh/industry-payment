const User = require("../models/User");

async function adminMiddleware(req, res, next) {
  try {
    const user = await User.findById(req.user?.sub);
    if (!user || user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    req.admin = user;
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = adminMiddleware;
