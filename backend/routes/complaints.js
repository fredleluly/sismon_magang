const router = require('express').Router();
// const Complaint = require('../models/Complaint');
const db = require('../db');
const { auth, adminOnly } = require('../middleware/auth');

// GET /api/complaints — user: own, admin: all
router.get('/', auth, async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { userId: req.userId };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.prioritas) filter.prioritas = req.query.prioritas;

    let complaints = await db.complaints.find(filter).sort({ createdAt: -1 });

    // Manual Populate
    complaints = await Promise.all(complaints.map(async (c) => {
        const user = await db.users.findOne({ _id: c.userId });
        return { 
            ...c, 
            userId: user ? { _id: user._id, name: user.name, email: user.email, instansi: user.instansi } : null 
        };
    }));

    res.json({ success: true, data: complaints });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/complaints — user creates complaint
router.post('/', auth, async (req, res) => {
  try {
    const { judul, kategori, prioritas, deskripsi } = req.body;
    if (!judul || !deskripsi) {
      return res.status(400).json({ success: false, message: 'Judul dan deskripsi wajib diisi.' });
    }

    const complaint = await db.complaints.insert({
      userId: req.userId,
      judul, kategori: kategori || 'Lainnya',
      prioritas: prioritas || 'Medium',
      deskripsi,
      status: 'Menunggu', // Default status if not in schema
      createdAt: new Date(),
      updatedAt: new Date()
    });

    res.status(201).json({ success: true, message: 'Laporan kendala berhasil dikirim.', data: complaint });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/complaints/:id/status — admin updates status
router.put('/:id/status', auth, adminOnly, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['Menunggu', 'Diproses', 'Selesai'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status tidak valid.' });
    }

    const complaint = await db.complaints.findOne({ _id: req.params.id });
     if (!complaint) return res.status(404).json({ success: false, message: 'Laporan tidak ditemukan.' });
    
    complaint.status = status;
    complaint.updatedAt = new Date();
    await db.complaints.update({ _id: req.params.id }, complaint);

    // populate for response
    const user = await db.users.findOne({ _id: complaint.userId });
    complaint.userId = user ? { _id: user._id, name: user.name, email: user.email } : null;
    if (!complaint) return res.status(404).json({ success: false, message: 'Laporan tidak ditemukan.' });

    res.json({ success: true, message: `Status diubah ke "${status}".`, data: complaint });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/complaints/stats — admin: complaint stats
router.get('/stats', auth, adminOnly, async (req, res) => {
  try {
    const total = await db.complaints.count({});
    const menunggu = await db.complaints.count({ status: 'Menunggu' });
    const diproses = await db.complaints.count({ status: 'Diproses' });
    const selesai = await db.complaints.count({ status: 'Selesai' });

    res.json({ success: true, data: { total, menunggu, diproses, selesai } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
