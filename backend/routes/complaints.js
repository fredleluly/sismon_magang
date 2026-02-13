const router = require('express').Router();
const Complaint = require('../models/Complaint');
const { auth, adminOnly } = require('../middleware/auth');

// GET /api/complaints — user: own, admin: all
router.get('/', auth, async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { userId: req.userId };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.prioritas) filter.prioritas = req.query.prioritas;

    const complaints = await Complaint.find(filter)
      .populate('userId', 'name email instansi')
      .sort({ createdAt: -1 });

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

    const complaint = await Complaint.create({
      userId: req.userId,
      judul, kategori: kategori || 'Lainnya',
      prioritas: prioritas || 'Medium',
      deskripsi
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

    const complaint = await Complaint.findByIdAndUpdate(req.params.id, { status }, { new: true })
      .populate('userId', 'name email');
    if (!complaint) return res.status(404).json({ success: false, message: 'Laporan tidak ditemukan.' });

    res.json({ success: true, message: `Status diubah ke "${status}".`, data: complaint });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/complaints/stats — admin: complaint stats
router.get('/stats', auth, adminOnly, async (req, res) => {
  try {
    const total = await Complaint.countDocuments();
    const menunggu = await Complaint.countDocuments({ status: 'Menunggu' });
    const diproses = await Complaint.countDocuments({ status: 'Diproses' });
    const selesai = await Complaint.countDocuments({ status: 'Selesai' });

    res.json({ success: true, data: { total, menunggu, diproses, selesai } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
