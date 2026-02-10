const router = require('express').Router();
const Attendance = require('../models/Attendance');
const QRCode = require('../models/QRCode');
const { auth, adminOnly } = require('../middleware/auth');

// GET /api/attendance — user: own history, admin: all
router.get('/', auth, async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { userId: req.userId };
    if (req.query.from || req.query.to) {
      filter.tanggal = {};
      if (req.query.from) filter.tanggal.$gte = new Date(req.query.from);
      if (req.query.to) filter.tanggal.$lte = new Date(req.query.to);
    }

    const records = await Attendance.find(filter)
      .populate('userId', 'name email instansi')
      .sort({ tanggal: -1 })
      .limit(parseInt(req.query.limit) || 50);

    res.json({ success: true, data: records });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/attendance/scan — user scans QR to record attendance
router.post('/scan', auth, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ success: false, message: 'Token QR wajib diisi.' });

    // Verify QR code
    const qr = await QRCode.findOne({ token, active: true });
    if (!qr) return res.status(400).json({ success: false, message: 'QR Code tidak valid atau sudah expired.' });

    // Check if QR is for today
    const today = new Date().toISOString().split('T')[0];
    const qrDate = qr.tanggal.toISOString().split('T')[0];
    if (today !== qrDate) {
      return res.status(400).json({ success: false, message: 'QR Code sudah expired (bukan untuk hari ini).' });
    }

    // Check if already scanned today
    const existingAttendance = await Attendance.findOne({
      userId: req.userId,
      tanggal: { $gte: new Date(today), $lt: new Date(today + 'T23:59:59') }
    });
    if (existingAttendance) {
      return res.status(400).json({ success: false, message: 'Anda sudah absen hari ini.' });
    }

    const now = new Date();
    const jamMasuk = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    const attendance = await Attendance.create({
      userId: req.userId,
      tanggal: new Date(today),
      jamMasuk,
      jamKeluar: '',
      status: 'Hadir',
      qrCodeId: qr._id
    });

    // Track scanned user on QR
    if (!qr.scannedBy.includes(req.userId)) {
      qr.scannedBy.push(req.userId);
      await qr.save();
    }

    res.status(201).json({ success: true, message: 'Absensi berhasil!', data: attendance });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'Anda sudah absen hari ini.' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/attendance/:id/checkout — clock out
router.put('/:id/checkout', auth, async (req, res) => {
  try {
    const att = await Attendance.findById(req.params.id);
    if (!att) return res.status(404).json({ success: false, message: 'Data absensi tidak ditemukan.' });
    if (att.userId.toString() !== req.userId.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Akses ditolak.' });
    }

    const now = new Date();
    att.jamKeluar = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    await att.save();

    res.json({ success: true, message: 'Berhasil clock out.', data: att });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/attendance/today — admin: who attended today
router.get('/today', auth, adminOnly, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const records = await Attendance.find({
      tanggal: { $gte: new Date(today), $lt: new Date(today + 'T23:59:59') }
    }).populate('userId', 'name email instansi');

    res.json({ success: true, data: records });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
