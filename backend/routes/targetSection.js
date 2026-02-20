const express = require('express');
const router = express.Router();
const TargetSection = require('../models/TargetSection');
const Settings = require('../models/Settings');
const { auth, adminOnly } = require('../middleware/auth');

// GET /api/target-section/upah-harian — get upah harian value
router.get('/upah-harian', auth, adminOnly, async (req, res) => {
  try {
    const setting = await Settings.findOne({ key: 'upahHarian' });
    res.json({ success: true, data: { upahHarian: setting ? setting.value : 0 } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/target-section/upah-harian — set upah harian value (admin only)
router.put('/upah-harian', auth, adminOnly, async (req, res) => {
  try {
    const { upahHarian } = req.body;
    if (upahHarian === undefined || upahHarian === null || isNaN(Number(upahHarian))) {
      return res.status(400).json({ success: false, message: 'Nilai upah harian harus berupa angka.' });
    }
    const setting = await Settings.findOneAndUpdate(
      { key: 'upahHarian' },
      { $set: { key: 'upahHarian', value: Number(upahHarian) } },
      { upsert: true, new: true }
    );
    res.json({ success: true, message: 'Upah harian berhasil disimpan.', data: { upahHarian: setting.value } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/target-section — list all targets
router.get('/', auth, adminOnly, async (req, res) => {
  try {
    const targets = await TargetSection.find().sort({ jenis: 1 });
    res.json({ success: true, data: targets });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/target-section — bulk upsert targets
router.put('/', auth, adminOnly, async (req, res) => {
  try {
    const { targets } = req.body; // [{ jenis, targetPerDay }]

    if (!Array.isArray(targets)) {
      return res.status(400).json({ success: false, message: 'Data targets harus berupa array.' });
    }

    const ops = targets.map(t => ({
      updateOne: {
        filter: { jenis: t.jenis },
        update: { $set: { jenis: t.jenis, targetPerDay: t.targetPerDay || 0 } },
        upsert: true
      }
    }));

    await TargetSection.bulkWrite(ops);
    const updated = await TargetSection.find().sort({ jenis: 1 });
    res.json({ success: true, message: 'Target berhasil disimpan.', data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
