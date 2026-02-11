const router = require('express').Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

// Generate JWT
function generateToken(user) {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, instansi } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Nama, email, dan password wajib diisi.' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Email sudah terdaftar.' });
    }

    const user = await User.create({ name, email, password, instansi, role: 'user' });
    const token = generateToken(user);

    res.status(201).json({
      success: true,
      message: 'Pendaftaran berhasil!',
      data: { user: user.toJSON(), token }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email dan password wajib diisi.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Email atau password salah.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Email atau password salah.' });
    }

    const token = generateToken(user);

    res.json({
      success: true,
      message: `Login berhasil! Selamat datang, ${user.name}.`,
      data: { user: user.toJSON(), token }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/auth/me — get current user profile
router.get('/me', auth, async (req, res) => {
  res.json({ success: true, data: req.user.toJSON() });
});

// PUT /api/auth/profile — update own profile
router.put('/profile', auth, async (req, res) => {
  try {
    const { name, email, instansi, jabatan, password } = req.body;
    const user = req.user;

    if (name) user.name = name;
    if (email) user.email = email;
    if (instansi) user.instansi = instansi;
    if (jabatan) user.jabatan = jabatan;
    if (password) user.password = password;

    await user.save();
    res.json({ success: true, message: 'Profil berhasil diperbarui.', data: user.toJSON() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/auth/change-password — change user password
router.post('/change-password', auth, async (req, res) => {
  try {
    const { newPassword } = req.body;
    const user = req.user;

    if (!newPassword) {
      return res.status(400).json({ success: false, message: 'Password baru wajib diisi.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password minimal 6 karakter.' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ success: true, message: 'Password berhasil diubah.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
