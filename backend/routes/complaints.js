const router = require('express').Router();
const Complaint = require('../models/Complaint');
const { auth, adminOnly } = require('../middleware/auth');

// GET /api/complaints — user: own, admin: all
router.get('/', auth, async (req, res) => {
  try {
    const filter = req.user.role === 'admin' || req.user.role === 'superadmin' ? {} : { userId: req.userId };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.prioritas) filter.prioritas = req.query.prioritas;

    const complaints = await Complaint.find(filter).populate('userId', 'name email instansi').sort({ createdAt: -1 });

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
      judul,
      kategori: kategori || 'Lainnya',
      prioritas: prioritas || 'Medium',
      deskripsi,
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

    const complaint = await Complaint.findByIdAndUpdate(req.params.id, { status }, { new: true }).populate('userId', 'name email');
    if (!complaint) return res.status(404).json({ success: false, message: 'Laporan tidak ditemukan.' });

    res.json({ success: true, message: `Status diubah ke "${status}".`, data: complaint });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/complaints/:id — user updates own complaint (only if status is 'Menunggu')
router.put('/:id', auth, async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return res.status(404).json({ success: false, message: 'Laporan tidak ditemukan.' });

    // Only owner can edit
    if (!complaint.userId.equals(req.userId)) {
      return res.status(403).json({ success: false, message: 'Anda tidak memiliki akses.' });
    }

    // Only allow editing if status is still 'Menunggu'
    if (complaint.status !== 'Menunggu') {
      return res.status(400).json({ success: false, message: 'Laporan yang sudah diproses tidak dapat diedit.' });
    }

    const { judul, kategori, prioritas, deskripsi } = req.body;
    if (judul) complaint.judul = judul;
    if (kategori) complaint.kategori = kategori;
    if (prioritas) complaint.prioritas = prioritas;
    if (deskripsi) complaint.deskripsi = deskripsi;

    await complaint.save();
    res.json({ success: true, message: 'Laporan berhasil diperbarui.', data: complaint });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/complaints/:id — user deletes own complaint (only if status is 'Menunggu')
router.delete('/:id', auth, async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return res.status(404).json({ success: false, message: 'Laporan tidak ditemukan.' });

    // Owner or admin can delete
    const isOwner = complaint.userId.equals(req.userId);
    const isAdmin = req.user.role === 'admin' || req.user.role === 'superadmin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Anda tidak memiliki akses.' });
    }

    // User can only delete if status is 'Menunggu', admin can always delete
    if (isOwner && !isAdmin && complaint.status !== 'Menunggu') {
      return res.status(400).json({ success: false, message: 'Laporan yang sudah diproses tidak dapat dihapus.' });
    }

    await Complaint.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Laporan berhasil dihapus.' });
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
