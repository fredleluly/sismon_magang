const jwt = require('jsonwebtoken');
// const User = require('../models/User'); // Removed Mongoose model
const db = require('../db'); // Import NeDB

// Verify JWT token
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, message: 'Token tidak ditemukan. Silakan login.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // const user = await User.findById(decoded.id);
    const user = await db.users.findOne({ _id: decoded.id });
    
    if (!user) {
      return res.status(401).json({ success: false, message: 'User tidak ditemukan.' });
    }
    
    // Helper to simulate Mongoose document method if needed, or just attach plain object
    // user.toJSON = () => { ... } // NeDB returns plain objects usually

    req.user = user;
    req.userId = user._id;
    next();
  } catch (err) {
    res.status(401).json({ success: false, message: 'Token tidak valid. Silakan login ulang.' });
  }
};

// Admin-only middleware
const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Akses ditolak. Hanya admin.' });
  }
  next();
};

module.exports = { auth, adminOnly };
