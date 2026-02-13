const router = require('express').Router();
// const User = require('../models/User');
// const WorkLog = require('../models/WorkLog');
const db = require('../db');
const { auth, adminOnly } = require('../middleware/auth');

// GET /api/users — list all users (admin) or get own data (user)
router.get('/', auth, async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      const users = await db.users.find({ role: 'user' }).sort({ createdAt: -1 });

      // Enrich with work stats
      const enriched = await Promise.all(users.map(async (u) => {
        // NeDB Manual Aggregation
        const logs = await db.workLogs.find({ userId: u._id, status: 'Selesai' });
        const s = logs.reduce((acc, log) => ({
          berkas: acc.berkas + (log.berkas || 0),
          buku: acc.buku + (log.buku || 0),
          bundle: acc.bundle + (log.bundle || 0)
        }), { berkas: 0, buku: 0, bundle: 0 });

        return { ...u, totalBerkas: s.berkas, totalBuku: s.buku, totalBundle: s.bundle };
      }));

      return res.json({ success: true, data: enriched });
    }

    // User: return own data
    res.json({ success: true, data: [req.user] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/users/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const user = await db.users.findOne({ _id: req.params.id });
    if (!user) return res.status(404).json({ success: false, message: 'User tidak ditemukan.' });

    // Only admin can view other users
    if (req.user.role !== 'admin' && req.userId.toString() !== req.params.id) {
      return res.status(403).json({ success: false, message: 'Akses ditolak.' });
    }

    const logs = await db.workLogs.find({ userId: user._id, status: 'Selesai' });
    const s = logs.reduce((acc, log) => ({
      berkas: acc.berkas + (log.berkas || 0),
      buku: acc.buku + (log.buku || 0),
      bundle: acc.bundle + (log.bundle || 0)
    }), { berkas: 0, buku: 0, bundle: 0 });

    res.json({ success: true, data: { ...user, totalBerkas: s.berkas, totalBuku: s.buku, totalBundle: s.bundle } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/users — admin create user
router.post('/', auth, adminOnly, async (req, res) => {
  try {
    const { name, email, password, instansi, status } = req.body;
    if (!name || !email) return res.status(400).json({ success: false, message: 'Nama dan email wajib diisi.' });

    const existing = await db.users.findOne({ email });
    if (existing) return res.status(400).json({ success: false, message: 'Email sudah terdaftar.' });

    const newUser = {
      name, email, password: password || 'magang123', instansi, status: status || 'Aktif', role: 'user',
      createdAt: new Date(), updatedAt: new Date()
    };
    const user = await db.users.insert(newUser);

    res.status(201).json({ success: true, message: 'Peserta berhasil ditambahkan.', data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/users/:id — admin update user
router.put('/:id', auth, adminOnly, async (req, res) => {
  try {
    const { name, email, instansi, status } = req.body;
    const user = await db.users.findOne({ _id: req.params.id });
    if (!user) return res.status(404).json({ success: false, message: 'User tidak ditemukan.' });

    if (name) user.name = name;
    if (email) user.email = email;
    if (instansi) user.instansi = instansi;
    if (status) user.status = status;
    user.updatedAt = new Date();

    await db.users.update({ _id: req.params.id }, user);
    res.json({ success: true, message: 'Data peserta berhasil diupdate.', data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/users/:id/reset-password — admin reset user password
router.put('/:id/reset-password', auth, adminOnly, async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password minimal 6 karakter.' });
    }

    const user = await db.users.findOne({ _id: req.params.id });
    if (!user) return res.status(404).json({ success: false, message: 'User tidak ditemukan.' });

    user.password = newPassword;
    user.updatedAt = new Date();
    await db.users.update({ _id: req.params.id }, user);

    res.json({ success: true, message: 'Password berhasil direset.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/users/:id — admin delete user
router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    // NeDB remove is deprecated in favor of remove usually, but nedb-promises uses remove(query, { multi: false })
    const numRemoved = await db.users.remove({ _id: req.params.id }, { multi: false });
    if (numRemoved === 0) return res.status(404).json({ success: false, message: 'User tidak ditemukan.' });
    res.json({ success: true, message: 'Peserta berhasil dihapus.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
