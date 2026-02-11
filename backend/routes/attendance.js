const router = require('express').Router();
const Attendance = require('../models/Attendance');
const QRCode = require('../models/QRCode');
const { auth, adminOnly } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Multer setup untuk upload foto
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'absensi-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Hanya file gambar (JPG, PNG) yang diizinkan'));
    }
  }
});

// Helper: Check if time is late
const isLate = (timeStr, threshold = '08:00') => {
  try {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const [thresholdHours, thresholdMinutes] = threshold.split(':').map(Number);
    const currentTime = hours * 60 + minutes;
    const thresholdTime = thresholdHours * 60 + thresholdMinutes;
    return currentTime > thresholdTime;
  } catch {
    return false;
  }
};

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
      tanggal: { $gte: new Date(today), $lt: new Date(today + 'T23:59:59') },
    });
    if (existingAttendance) {
      return res.status(400).json({ success: false, message: 'Anda sudah absen hari ini.' });
    }

    const now = new Date();
    const jamMasuk = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    // Get late threshold (default 08:00)
    const lateThreshold = process.env.LATE_THRESHOLD || '08:00';

    // Determine status based on time
    const status = isLate(jamMasuk, lateThreshold) ? 'Telat' : 'Hadir';

    const attendance = await Attendance.create({
      userId: req.userId,
      tanggal: new Date(today),
      jamMasuk,
      jamKeluar: '',
      status,
      qrCodeId: qr._id,
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

// POST /api/attendance/photo-checkin — user takes photo to record attendance
// Supports both base64 (foto field) and file upload (foto file)
router.post('/photo-checkin', auth, upload.single('foto'), async (req, res) => {
  try {
    const { foto, timestamp, timezone } = req.body;
    
    // Check if photo provided (either as file or base64)
    if (!req.file && !foto) {
      return res.status(400).json({ success: false, message: 'Foto wajib diambil untuk absensi.' });
    }

    // Check if already scanned today
    const today = new Date().toISOString().split('T')[0];
    const existingAttendance = await Attendance.findOne({
      userId: req.userId,
      tanggal: { $gte: new Date(today), $lt: new Date(today + 'T23:59:59') },
    });
    if (existingAttendance) {
      return res.status(400).json({ success: false, message: 'Anda sudah absen hari ini.' });
    }

    // Use timestamp from user's device if provided, otherwise server time
    let jamMasuk;
    if (timestamp) {
      const userDate = new Date(timestamp);
      jamMasuk = userDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    } else {
      const now = new Date();
      jamMasuk = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    }

    // Get late threshold (default 08:00)
    const lateThreshold = process.env.LATE_THRESHOLD || '08:00';
    const status = isLate(jamMasuk, lateThreshold) ? 'Telat' : 'Hadir';

    const fotoTimestamp = timestamp
      ? new Date(timestamp).toLocaleString('id-ID', { timeZone: timezone || 'Asia/Jakarta' })
      : new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

    // Prepare attendance data
    const attendanceData = {
      userId: req.userId,
      tanggal: new Date(today),
      jamMasuk,
      jamKeluar: '',
      status,
      fotoTimestamp,
    };

    // If file uploaded, store URL; otherwise store base64
    if (req.file) {
      attendanceData.fotoUrl = `/uploads/${req.file.filename}`;
    } else if (foto) {
      attendanceData.fotoAbsensi = foto;
    }

    const attendance = await Attendance.create(attendanceData);

    res.status(201).json({ success: true, message: 'Absensi dengan foto berhasil!', data: attendance });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'Anda sudah absen hari ini.' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/attendance/photo-upload — upload photo file and get URL
router.post('/photo-upload', auth, upload.single('foto'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    // Return the file URL path
    const fotoUrl = `/uploads/${req.file.filename}`;
    res.json({ 
      success: true, 
      data: { 
        fotoUrl,
        filename: req.file.filename,
        size: req.file.size 
      } 
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/attendance/:id/status — admin: update attendance status and jamMasuk
router.put('/:id/status', auth, adminOnly, async (req, res) => {
  try {
    const { status, jamMasuk } = req.body;
    if (!status) return res.status(400).json({ success: false, message: 'Status wajib diisi.' });

    const allowed = ['Hadir', 'Telat', 'Izin', 'Sakit', 'Alpha'];
    if (!allowed.includes(status)) return res.status(400).json({ success: false, message: 'Status tidak valid.' });

    const att = await Attendance.findById(req.params.id);
    if (!att) return res.status(404).json({ success: false, message: 'Data absensi tidak ditemukan.' });

    att.status = status;

    // Update jamMasuk if provided (format: HH:MM)
    if (jamMasuk) {
      // Validate format
      if (!/^\d{2}:\d{2}$/.test(jamMasuk)) {
        return res.status(400).json({ success: false, message: 'Format jam masuk harus HH:MM (contoh: 08:30)' });
      }
      att.jamMasuk = jamMasuk;
    }

    await att.save();

    // return populated user info for frontend convenience
    const populated = await Attendance.findById(att._id).populate('userId', 'name email instansi');

    res.json({ success: true, message: 'Data absensi berhasil diperbarui.', data: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/attendance/today — admin: who attended today
// NOTE: Static routes MUST be defined before parameterized routes (/:id)
router.get('/today', auth, adminOnly, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const records = await Attendance.find({
      tanggal: { $gte: new Date(today), $lt: new Date(today + 'T23:59:59') },
    }).populate('userId', 'name email instansi');

    res.json({ success: true, data: records });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/attendance/settings/late-threshold — get late threshold
router.get('/settings/late-threshold', auth, async (req, res) => {
  try {
    const threshold = process.env.LATE_THRESHOLD || '08:00';
    res.json({ success: true, data: { lateThreshold: threshold } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/attendance/settings/late-threshold — set late threshold (admin only)
router.post('/settings/late-threshold', auth, adminOnly, async (req, res) => {
  try {
    const { threshold } = req.body;
    if (!threshold || !/^\d{2}:\d{2}$/.test(threshold)) {
      return res.status(400).json({ success: false, message: 'Format threshold harus HH:MM (contoh: 08:00)' });
    }
    process.env.LATE_THRESHOLD = threshold;
    res.json({ success: true, message: 'Late threshold berhasil diubah', data: { lateThreshold: threshold } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/attendance/:id/photo — get attendance photo
router.get('/:id/photo', auth, async (req, res) => {
  try {
    const att = await Attendance.findById(req.params.id);
    if (!att) return res.status(404).json({ success: false, message: 'Data absensi tidak ditemukan.' });

    // Only the user or admin can view the photo
    if (att.userId.toString() !== req.userId.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Akses ditolak.' });
    }

    // Priority: fotoUrl (file upload) > fotoAbsensi (base64)
    let fotoData;
    if (att.fotoUrl) {
      // If photo stored as file, return full URL
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      fotoData = `${baseUrl}${att.fotoUrl}`;
    } else if (att.fotoAbsensi) {
      // Fall back to base64
      fotoData = att.fotoAbsensi;
    } else {
      return res.status(404).json({ success: false, message: 'Foto absensi tidak tersedia.' });
    }

    res.json({ success: true, data: { foto: fotoData, fotoTimestamp: att.fotoTimestamp } });
  } catch (err) {
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

// PUT /api/attendance/:id — admin update
router.put('/:id', auth, adminOnly, async (req, res) => {
  try {
    const { jamMasuk, jamKeluar, status } = req.body;
    const att = await Attendance.findById(req.params.id);
    if (!att) return res.status(404).json({ success: false, message: 'Data tidak ditemukan' });

    if (jamMasuk !== undefined) att.jamMasuk = jamMasuk;
    if (jamKeluar !== undefined) att.jamKeluar = jamKeluar;
    if (status !== undefined) att.status = status;

    await att.save();
    res.json({ success: true, message: 'Data berhasil diperbarui', data: att });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
