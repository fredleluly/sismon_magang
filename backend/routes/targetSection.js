const express = require('express');
const router = express.Router();
// const TargetSection = require('../models/TargetSection');
const db = require('../db');
const { auth, adminOnly } = require('../middleware/auth');

// GET /api/target-section — list all targets
router.get('/', auth, adminOnly, async (req, res) => {
  try {
    const targets = await db.targetSection.find({}).sort({ jenis: 1 });
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

    for (const t of targets) {
        await db.targetSection.update(
            { jenis: t.jenis },
            { $set: { jenis: t.jenis, targetPerDay: t.targetPerDay || 0 } },
            { upsert: true }
        );
    }

    const updated = await db.targetSection.find({}).sort({ jenis: 1 });
    res.json({ success: true, message: 'Target berhasil disimpan.', data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
