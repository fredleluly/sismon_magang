const router = require('express').Router();
const mongoose = require('mongoose');
const WorkLog = require('../models/WorkLog');
const { auth, adminOnly } = require('../middleware/auth');

// GET /api/work-logs — get work logs (user: own, admin: all)
router.get('/', auth, async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { userId: req.userId };

    // Optional query filters
    if (req.query.status) filter.status = req.query.status;
    if (req.query.userId && req.user.role === 'admin') filter.userId = req.query.userId;
    if (req.query.from || req.query.to) {
      filter.tanggal = {};
      if (req.query.from) filter.tanggal.$gte = new Date(req.query.from);
      if (req.query.to) filter.tanggal.$lte = new Date(req.query.to);
    }

    const logs = await WorkLog.find(filter)
      .populate('userId', 'name email instansi')
      .sort({ createdAt: -1 })
      .limit(parseInt(req.query.limit) || 100);

    res.json({ success: true, data: logs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/work-logs/recap — admin recap: pivot per user per jenis
router.get('/recap', auth, adminOnly, async (req, res) => {
  try {
    const filter = { status: 'Selesai' };
    if (req.query.from || req.query.to) {
      filter.tanggal = {};
      if (req.query.from) filter.tanggal.$gte = new Date(req.query.from);
      if (req.query.to) {
        const toDate = new Date(req.query.to);
        toDate.setHours(23, 59, 59, 999);
        filter.tanggal.$lte = toDate;
      }
    }
    if (req.query.userIds) {
      const ids = req.query.userIds.split(',').filter(Boolean).map(id => new mongoose.Types.ObjectId(id));
      if (ids.length) filter.userId = { $in: ids };
    }

    const data = await WorkLog.aggregate([
      { $match: filter },
      {
        $group: {
          _id: { userId: '$userId', jenis: '$jenis' },
          berkas: { $sum: '$berkas' },
          buku: { $sum: '$buku' },
          bundle: { $sum: '$bundle' },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id.userId',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      {
        $project: {
          _id: 0,
          userId: '$_id.userId',
          userName: '$user.name',
          jenis: '$_id.jenis',
          berkas: 1,
          buku: 1,
          bundle: 1,
        },
      },
      { $sort: { userName: 1, jenis: 1 } },
    ]);

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/work-logs/stats/me — user's own totals
router.get('/stats/me', auth, async (req, res) => {
  try {
    const stats = await WorkLog.aggregate([
      { $match: { userId: req.userId, status: 'Selesai' } },
      { $group: { _id: null, berkas: { $sum: '$berkas' }, buku: { $sum: '$buku' }, bundle: { $sum: '$bundle' }, total: { $sum: 1 } } }
    ]);
    const s = stats[0] || { berkas: 0, buku: 0, bundle: 0, total: 0 };
    res.json({ success: true, data: s });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/work-logs — create work log (user saves draft)
router.post('/', auth, async (req, res) => {
  try {
    const { tanggal, jenis, keterangan, berkas, buku, bundle, status } = req.body;

    if (!tanggal || !jenis) {
      return res.status(400).json({ success: false, message: 'Tanggal dan jenis pekerjaan wajib diisi.' });
    }

    const log = await WorkLog.create({
      userId: req.userId,
      tanggal, jenis, keterangan,
      berkas: berkas || 0,
      buku: buku || 0,
      bundle: bundle || 0,
      status: status || 'Draft'
    });

    res.status(201).json({ success: true, message: 'Data pekerjaan berhasil disimpan.', data: log });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/work-logs/:id — update work log
router.put('/:id', auth, async (req, res) => {
  try {
    const log = await WorkLog.findById(req.params.id);
    if (!log) return res.status(404).json({ success: false, message: 'Data tidak ditemukan.' });

    // User can only edit own logs
    if (req.user.role !== 'admin' && log.userId.toString() !== req.userId.toString()) {
      return res.status(403).json({ success: false, message: 'Akses ditolak.' });
    }

    const { tanggal, jenis, keterangan, berkas, buku, bundle, status } = req.body;
    if (tanggal) log.tanggal = tanggal;
    if (jenis) log.jenis = jenis;
    if (keterangan !== undefined) log.keterangan = keterangan;
    if (berkas !== undefined) log.berkas = berkas;
    if (buku !== undefined) log.buku = buku;
    if (bundle !== undefined) log.bundle = bundle;
    if (status) log.status = status;

    await log.save();
    res.json({ success: true, message: 'Data berhasil diupdate.', data: log });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/work-logs/:id/submit — submit draft to final
router.put('/:id/submit', auth, async (req, res) => {
  try {
    const log = await WorkLog.findById(req.params.id);
    if (!log) return res.status(404).json({ success: false, message: 'Data tidak ditemukan.' });
    if (log.userId.toString() !== req.userId.toString()) {
      return res.status(403).json({ success: false, message: 'Akses ditolak.' });
    }

    log.status = 'Selesai';
    await log.save();
    res.json({ success: true, message: 'Data berhasil dikirim final!', data: log });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/work-logs/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const log = await WorkLog.findById(req.params.id);
    if (!log) return res.status(404).json({ success: false, message: 'Data tidak ditemukan.' });

    if (req.user.role !== 'admin' && log.userId.toString() !== req.userId.toString()) {
      return res.status(403).json({ success: false, message: 'Akses ditolak.' });
    }

    await log.deleteOne();
    res.json({ success: true, message: 'Data berhasil dihapus.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
