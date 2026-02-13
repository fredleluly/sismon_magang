const router = require('express').Router();
const crypto = require('crypto');
// const QRCode = require('../models/QRCode');
const db = require('../db');
const { auth, adminOnly } = require('../middleware/auth');

// POST /api/qrcode/generate — admin generates daily QR
router.post('/generate', auth, adminOnly, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Deactivate previous QR codes for today
    // Deactivate previous QR codes for today
    await db.qrcode.update(
      { tanggal: { $gte: new Date(today), $lt: new Date(today + 'T23:59:59') } },
      { $set: { active: false } },
      { multi: true }
    );

    const token = crypto.randomBytes(16).toString('hex');

    const qr = await db.qrcode.insert({
      tanggal: new Date(today),
      token,
      createdBy: req.userId,
      active: true,
      scannedBy: [],
      createdAt: new Date(),
      updatedAt: new Date()
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
    let qr = await db.qrcode.findOne({
      tanggal: { $gte: new Date(today), $lt: new Date(today + 'T23:59:59') },
      active: true
    });
    
    if (qr) {
        // Manual Populate
        const users = await Promise.all((qr.scannedBy || []).map(async (userId) => {
            const u = await db.users.findOne({ _id: userId });
            return u ? { _id: u._id, name: u.name, email: u.email } : null;
        }));
        qr.scannedBy = users.filter(u => u !== null);
    }

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

    const history = await db.qrcode.find({ tanggal: { $gte: sevenDaysAgo } })
      .sort({ tanggal: -1 })
      .limit(7);

    const data = history.map(qr => ({
      _id: qr._id,
      tanggal: qr.tanggal,
      scannedCount: (qr.scannedBy || []).length,
      active: qr.active,
      createdAt: qr.createdAt
    }));

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
