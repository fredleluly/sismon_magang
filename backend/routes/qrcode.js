const router = require('express').Router();
const crypto = require('crypto');
const QRCode = require('../models/QRCode');
const { auth, adminOnly } = require('../middleware/auth');

// POST /api/qrcode/generate — admin generates daily QR
router.post('/generate', auth, adminOnly, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Deactivate previous QR codes for today
    await QRCode.updateMany(
      { tanggal: { $gte: new Date(today), $lt: new Date(today + 'T23:59:59') } },
      { active: false }
    );

    const token = crypto.randomBytes(16).toString('hex');

    const qr = await QRCode.create({
      tanggal: new Date(today),
      token,
      createdBy: req.userId,
      active: true
    });

    res.status(201).json({
      success: true,
      message: 'QR Code berhasil di-generate!',
      data: {
        _id: qr._id,
        token: qr.token,
        tanggal: qr.tanggal,
        active: qr.active,
        // This is what gets encoded in the QR image on frontend
        qrPayload: JSON.stringify({ type: 'absensi', token: qr.token, date: today })
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/qrcode/today — get today's active QR
router.get('/today', auth, adminOnly, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const qr = await QRCode.findOne({
      tanggal: { $gte: new Date(today), $lt: new Date(today + 'T23:59:59') },
      active: true
    }).populate('scannedBy', 'name email');

    res.json({ success: true, data: qr });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/qrcode/history — QR history (last 7 days)
router.get('/history', auth, adminOnly, async (req, res) => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const history = await QRCode.find({ tanggal: { $gte: sevenDaysAgo } })
      .sort({ tanggal: -1 })
      .limit(7);

    const data = history.map(qr => ({
      _id: qr._id,
      tanggal: qr.tanggal,
      scannedCount: qr.scannedBy.length,
      active: qr.active,
      createdAt: qr.createdAt
    }));

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
