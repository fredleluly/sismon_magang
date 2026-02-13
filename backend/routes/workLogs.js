const router = require('express').Router();
// const mongoose = require('mongoose');
// const WorkLog = require('../models/WorkLog');
const db = require('../db');
const { auth, adminOnly } = require('../middleware/auth');

// GET /api/work-logs — get work logs (user: own, admin: all)
router.get('/', auth, async (req, res) => {
  try {
    let query = {};
    if (req.user.role !== 'admin') {
        query.userId = req.userId;
    }

    // Optional query filters
    if (req.query.status) query.status = req.query.status;
    if (req.query.userId && req.user.role === 'admin') query.userId = req.query.userId;
    if (req.query.userIds && req.user.role === 'admin') {
        const ids = req.query.userIds.split(',').filter(Boolean);
        if (ids.length) query.userId = { $in: ids };
    }
    if (req.query.from || req.query.to) {
      query.tanggal = {};
      if (req.query.from) query.tanggal.$gte = new Date(req.query.from);
      if (req.query.to) query.tanggal.$lte = new Date(req.query.to);
    }
    
    // Fetch logs
    let logs = await db.workLogs.find(query).sort({ createdAt: -1 });

    // Apply limit manually (NeDB sort + limit can be chainable in nedb-promises but pure array manipulation is safer for custom sort if needed, but nedb-promises supports sort/limit)
    // Using nedb-promises cursor-like features
    // However, since we need to populate, efficient way is: find -> sort -> limit -> populate
    // nedb-promises .find() returns a promise that resolves to array. To use cursor modifiers we strictly need to chain.
    // db.workLogs.find(query).sort(...) is valid in nedb-promises.
    // Let's re-query to use native sort/limit for efficiency if possible, or just slice array.
    // "nedb-promises" API: datastore.find(query).sort(...).limit(...)
    
    // Re-writing query with chain
    logs = await db.workLogs.find(query).sort({ createdAt: -1 }).limit(parseInt(req.query.limit) || 100);

    // Manual Populate
    const populatedLogs = await Promise.all(logs.map(async (log) => {
        const user = await db.users.findOne({ _id: log.userId });
        return { 
            ...log, 
            userId: user ? { _id: user._id, name: user.name, email: user.email, instansi: user.instansi } : null 
        };
    }));

    res.json({ success: true, data: populatedLogs });
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
      const ids = req.query.userIds.split(',').filter(Boolean); // Removed mongoose.Types.ObjectId
      if (ids.length) filter.userId = { $in: ids };
    }

    // NeDB Manual Aggregation
    let logs = await db.workLogs.find(filter);

    // Group by userId + jenis
    const grouped = {};
    for (const log of logs) {
        const key = `${log.userId}_${log.jenis}`;
        if (!grouped[key]) {
            grouped[key] = { userId: log.userId, jenis: log.jenis, berkas: 0, buku: 0, bundle: 0 };
        }
        grouped[key].berkas += (log.berkas || 0);
        grouped[key].buku += (log.buku || 0);
        grouped[key].bundle += (log.bundle || 0);
    }

    // Lookup User and Project
    const result = await Promise.all(Object.values(grouped).map(async (item) => {
        const user = await db.users.findOne({ _id: item.userId });
        if (!user) return null; // Should not happen if data integrity is good
        return {
            userId: item.userId,
            userName: user.name,
            jenis: item.jenis,
            berkas: item.berkas,
            buku: item.buku,
            bundle: item.bundle
        };
    }));

    // Filter nulls and Sort
    const data = result.filter(r => r !== null).sort((a, b) => {
        if (a.userName < b.userName) return -1;
        if (a.userName > b.userName) return 1;
        if (a.jenis < b.jenis) return -1;
        if (a.jenis > b.jenis) return 1;
        return 0;
    });

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/work-logs/stats/me — user's own totals
router.get('/stats/me', auth, async (req, res) => {
  try {
    // NeDB Manual Aggregation
    const logs = await db.workLogs.find({ userId: req.userId, status: 'Selesai' });
    const s = logs.reduce((acc, log) => ({
        berkas: acc.berkas + (log.berkas || 0),
        buku: acc.buku + (log.buku || 0),
        bundle: acc.bundle + (log.bundle || 0),
        total: acc.total + 1
    }), { berkas: 0, buku: 0, bundle: 0, total: 0 });

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

    const newLog = {
      userId: req.userId,
      tanggal, jenis, keterangan,
      berkas: berkas || 0,
      buku: buku || 0,
      bundle: bundle || 0,
      status: status || 'Draft',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const log = await db.workLogs.insert(newLog);

    res.status(201).json({ success: true, message: 'Data pekerjaan berhasil disimpan.', data: log });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/work-logs/:id — update work log
router.put('/:id', auth, async (req, res) => {
  try {
    const log = await db.workLogs.findOne({ _id: req.params.id });
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
    log.updatedAt = new Date();

    await db.workLogs.update({ _id: req.params.id }, log);
    res.json({ success: true, message: 'Data berhasil diupdate.', data: log });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/work-logs/:id/submit — submit draft to final
router.put('/:id/submit', auth, async (req, res) => {
  try {
    const log = await db.workLogs.findOne({ _id: req.params.id });
    if (!log) return res.status(404).json({ success: false, message: 'Data tidak ditemukan.' });
    if (log.userId.toString() !== req.userId.toString()) {
      return res.status(403).json({ success: false, message: 'Akses ditolak.' });
    }

    log.status = 'Selesai';
    log.updatedAt = new Date();
    await db.workLogs.update({ _id: req.params.id }, log);
    res.json({ success: true, message: 'Data berhasil dikirim final!', data: log });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/work-logs/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const log = await db.workLogs.findOne({ _id: req.params.id });
    if (!log) return res.status(404).json({ success: false, message: 'Data tidak ditemukan.' });

    if (req.user.role !== 'admin' && log.userId.toString() !== req.userId.toString()) {
      return res.status(403).json({ success: false, message: 'Akses ditolak.' });
    }

    await db.workLogs.remove({ _id: req.params.id }, { multi: false });
    res.json({ success: true, message: 'Data berhasil dihapus.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
