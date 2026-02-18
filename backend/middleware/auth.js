const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Verify JWT token
const auth = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return res
        .status(401)
        .json({
          success: false,
          message: "Token tidak ditemukan. Silakan login.",
        });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "User tidak ditemukan." });
    }

    req.user = user;
    req.userId = user._id;
    next();
  } catch (err) {
    res
      .status(401)
      .json({
        success: false,
        message: "Token tidak valid. Silakan login ulang.",
      });
  }
};

// Admin-only middleware (allows admin and superadmin)
const adminOnly = (req, res, next) => {
  if (req.user.role !== "admin" && req.user.role !== "superadmin") {
    return res
      .status(403)
      .json({ success: false, message: "Akses ditolak. Hanya admin." });
  }
  next();
};

module.exports = { auth, adminOnly };
