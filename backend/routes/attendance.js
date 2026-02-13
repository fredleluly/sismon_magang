const router = require('express').Router();
// const Attendance = require('../models/Attendance');
// const QRCode = require('../models/QRCode');
const db = require('../db');
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

    // Fetch records
    let records = await db.attendance.find(filter).sort({ tanggal: -1 }).limit(parseInt(req.query.limit) || 50);

    // Manual populate
    records = await Promise.all(records.map(async (r) => {
        const user = await db.users.findOne({ _id: r.userId });
        return { 
            ...r, 
            userId: user ? { _id: user._id, name: user.name, email: user.email, instansi: user.instansi } : null 
        };
    }));

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
    const qr = await db.qrcode.findOne({ token, active: true });
    if (!qr) return res.status(400).json({ success: false, message: 'QR Code tidak valid atau sudah expired.' });

    // Check if QR is for today
    // Ensure qr.tanggal is Date object
    const qrDateObj = new Date(qr.tanggal);
    const todayStr = new Date().toISOString().split('T')[0];
    const qrDateStr = qrDateObj.toISOString().split('T')[0];
    
    if (todayStr !== qrDateStr) {
      return res.status(400).json({ success: false, message: 'QR Code sudah expired (bukan untuk hari ini).' });
    }

    // Check if already scanned today
    const existingAttendance = await db.attendance.findOne({
      userId: req.userId,
      tanggal: { $gte: new Date(todayStr), $lt: new Date(todayStr + 'T23:59:59') },
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

    const attendance = await db.attendance.insert({
      userId: req.userId,
      tanggal: new Date(todayStr),
      jamMasuk,
      jamKeluar: '',
      status,
      qrCodeId: qr._id,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Track scanned user on QR
    if (!qr.scannedBy) qr.scannedBy = [];
    if (!qr.scannedBy.includes(req.userId)) {
      // Use $push operator if supported by nedb-promises wrapper or manual update
      await db.qrcode.update({ _id: qr._id }, { $push: { scannedBy: req.userId } });
    }

    res.status(201).json({ success: true, message: 'Absensi berhasil!', data: attendance });
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(400).json({ success: false, message: 'Anda sudah absen hari ini.' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/attendance/photo-checkin — user takes photo to record attendance (masuk)
// Supports both base64 (foto field) and file upload (foto file)
router.post('/photo-checkin', auth, upload.single('foto'), async (req, res) => {
  try {
    const { foto, timestamp, timezone, latitude, longitude, address, accuracy } = req.body;
    
    // Check if photo provided (either as file or base64)
    if (!req.file && !foto) {
      return res.status(400).json({ success: false, message: 'Foto wajib diambil untuk absensi.' });
    }

    // Check if already scanned today
    const today = new Date().toISOString().split('T')[0];
    const existingAttendance = await db.attendance.findOne({
      userId: req.userId,
      tanggal: { $gte: new Date(today), $lt: new Date(today + 'T23:59:59') },
    });
    if (existingAttendance) {
      return res.status(400).json({ success: false, message: 'Anda sudah absen masuk hari ini.' });
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
      locationMasuk: {
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        address: address || '',
        accuracy: accuracy ? parseFloat(accuracy) : null,
      },
    };

    // If file uploaded, store URL; otherwise store base64
    if (req.file) {
      attendanceData.fotoUrl = `/uploads/${req.file.filename}`;
    } else if (foto) {
      attendanceData.fotoAbsensi = foto;
    }

    attendanceData.createdAt = new Date();
    attendanceData.updatedAt = new Date();
    const attendance = await db.attendance.insert(attendanceData);

    res.status(201).json({ success: true, message: 'Absensi masuk dengan foto berhasil!', data: attendance });
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(400).json({ success: false, message: 'Anda sudah absen masuk hari ini.' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/attendance/photo-checkout — user takes photo to record checkout (pulang)
router.post('/photo-checkout', auth, upload.single('foto'), async (req, res) => {
  try {
    const { foto, timestamp, timezone, latitude, longitude, address, accuracy } = req.body;
    
    if (!req.file && !foto) {
      return res.status(400).json({ success: false, message: 'Foto wajib diambil untuk absensi pulang.' });
    }

    // Find today's attendance record
    const today = new Date().toISOString().split('T')[0];
    const attendance = await db.attendance.findOne({
      userId: req.userId,
      tanggal: { $gte: new Date(today), $lt: new Date(today + 'T23:59:59') },
    });

    if (!attendance) {
      return res.status(400).json({ success: false, message: 'Anda belum absen masuk hari ini. Silakan absen masuk terlebih dahulu.' });
    }

    if (attendance.jamKeluar && attendance.jamKeluar !== '' && attendance.jamKeluar !== '-') {
      return res.status(400).json({ success: false, message: 'Anda sudah absen pulang hari ini.' });
    }

    // Use timestamp from user's device if provided, otherwise server time
    let jamKeluar;
    if (timestamp) {
      const userDate = new Date(timestamp);
      jamKeluar = userDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    } else {
      const now = new Date();
      jamKeluar = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    }

    const fotoPulangTimestamp = timestamp
      ? new Date(timestamp).toLocaleString('id-ID', { timeZone: timezone || 'Asia/Jakarta' })
      : new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

    attendance.jamKeluar = jamKeluar;
    attendance.fotoPulangTimestamp = fotoPulangTimestamp;
    attendance.locationPulang = {
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      address: address || '',
      accuracy: accuracy ? parseFloat(accuracy) : null,
    };

    if (req.file) {
      attendance.fotoPulangUrl = `/uploads/${req.file.filename}`;
    } else if (foto) {
      attendance.fotoPulang = foto;
    }

    attendance.updatedAt = new Date();
    await db.attendance.update({ _id: attendance._id }, attendance);

    res.json({ success: true, message: 'Absensi pulang berhasil!', data: attendance });
  } catch (err) {
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
    const { status, jamMasuk, jamKeluar } = req.body;
    if (!status) return res.status(400).json({ success: false, message: 'Status wajib diisi.' });

    const allowed = ['Hadir', 'Telat', 'Izin', 'Sakit', 'Alpha', 'Hari Libur', 'Belum Absen'];
    if (!allowed.includes(status)) return res.status(400).json({ success: false, message: 'Status tidak valid.' });

    const att = await db.attendance.findOne({ _id: req.params.id });
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

    // Update jamKeluar if provided (format: HH:MM or empty string)
    if (jamKeluar !== undefined) {
      if (jamKeluar && !/^\d{2}:\d{2}$/.test(jamKeluar)) {
        return res.status(400).json({ success: false, message: 'Format jam keluar harus HH:MM (contoh: 17:00)' });
      }
      att.jamKeluar = jamKeluar;
    }

    att.updatedAt = new Date();
    await db.attendance.update({ _id: att._id }, att);

    // return populated user info for frontend convenience
    const user = await db.users.findOne({ _id: att.userId });
    const populated = { 
        ...att, 
        userId: user ? { _id: user._id, name: user.name, email: user.email, instansi: user.instansi } : null 
    };

    res.json({ success: true, message: 'Data absensi berhasil diperbarui.', data: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/attendance/bulk-holiday — admin: set all users to Hari Libur for a given date
router.post('/bulk-holiday', auth, adminOnly, async (req, res) => {
  try {
    const { tanggal } = req.body;
    if (!tanggal) return res.status(400).json({ success: false, message: 'Tanggal wajib diisi.' });

    // const User = require('../models/User'); // Already require db
    const users = await db.users.find({ role: 'user' });

    const dateStr = new Date(tanggal).toISOString().split('T')[0];
    const targetDate = new Date(dateStr);

    let created = 0;
    let updated = 0;

    for (const user of users) {
      const existing = await db.attendance.findOne({
        userId: user._id,
        tanggal: { $gte: new Date(dateStr), $lt: new Date(dateStr + 'T23:59:59') },
      });

      if (existing) {
        existing.status = 'Hari Libur';
        existing.jamMasuk = '-';
        existing.updatedAt = new Date();
        await db.attendance.update({ _id: existing._id }, existing);
        updated++;
      } else {
        await db.attendance.insert({
          userId: user._id,
          tanggal: targetDate,
          jamMasuk: '-',
          jamKeluar: '',
          status: 'Hari Libur',
          createdAt: new Date(),
          updatedAt: new Date()
        });
        created++;
      }
    }

    res.json({
      success: true,
      message: `Hari libur berhasil diterapkan. ${created} dibuat, ${updated} diperbarui.`,
      data: { created, updated, total: users.length },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/attendance/cancel-holiday — admin: cancel holiday, delete all attendance records for that date
router.post('/cancel-holiday', auth, adminOnly, async (req, res) => {
  try {
    const { tanggal } = req.body;
    if (!tanggal) return res.status(400).json({ success: false, message: 'Tanggal wajib diisi.' });

    const dateStr = new Date(tanggal).toISOString().split('T')[0];

    // Delete all attendance records for this date (they were created by bulk-holiday)
    // NeDB remove returns number of removed documents
    const numRemoved = await db.attendance.remove({
      tanggal: { $gte: new Date(dateStr), $lt: new Date(dateStr + 'T23:59:59') },
      status: 'Hari Libur',
    }, { multi: true });

    const result = { deletedCount: numRemoved };

    res.json({
      success: true,
      message: `Hari libur berhasil dibatalkan. ${result.deletedCount} data dihapus. Peserta dapat absen ulang.`,
      data: { deleted: result.deletedCount },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/attendance/today — admin: who attended today
// NOTE: Static routes MUST be defined before parameterized routes (/:id)
router.get('/today', auth, adminOnly, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    let records = await db.attendance.find({
      tanggal: { $gte: new Date(today), $lt: new Date(today + 'T23:59:59') },
    });
    
    // Manual Populate
    records = await Promise.all(records.map(async (r) => {
        const user = await db.users.findOne({ _id: r.userId });
         return { 
            ...r, 
            userId: user ? { _id: user._id, name: user.name, email: user.email, instansi: user.instansi } : null 
        };
    }));

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
    const att = await db.attendance.findOne({ _id: req.params.id });
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

// GET /api/attendance/:id/photo-pulang — get checkout photo
router.get('/:id/photo-pulang', auth, async (req, res) => {
  try {
    const att = await db.attendance.findOne({ _id: req.params.id });
    if (!att) return res.status(404).json({ success: false, message: 'Data absensi tidak ditemukan.' });

    if (att.userId.toString() !== req.userId.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Akses ditolak.' });
    }

    let fotoData;
    if (att.fotoPulangUrl) {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      fotoData = `${baseUrl}${att.fotoPulangUrl}`;
    } else if (att.fotoPulang) {
      fotoData = att.fotoPulang;
    } else {
      return res.status(404).json({ success: false, message: 'Foto pulang tidak tersedia.' });
    }

    res.json({ success: true, data: { foto: fotoData, fotoTimestamp: att.fotoPulangTimestamp } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/attendance/:id/checkout — clock out (legacy, simple)
router.put('/:id/checkout', auth, async (req, res) => {
  try {
    const att = await db.attendance.findOne({ _id: req.params.id });
    if (!att) return res.status(404).json({ success: false, message: 'Data absensi tidak ditemukan.' });
    if (att.userId.toString() !== req.userId.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Akses ditolak.' });
    }

    const now = new Date();
    att.jamKeluar = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    att.updatedAt = new Date();
    await db.attendance.update({ _id: att._id }, att);

    res.json({ success: true, message: 'Berhasil clock out.', data: att });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/attendance/:id — admin update
router.put('/:id', auth, adminOnly, async (req, res) => {
  try {
    const { jamMasuk, jamKeluar, status } = req.body;
    const att = await db.attendance.findOne({ _id: req.params.id });
    if (!att) return res.status(404).json({ success: false, message: 'Data tidak ditemukan' });

    if (jamMasuk !== undefined) att.jamMasuk = jamMasuk;
    if (jamKeluar !== undefined) att.jamKeluar = jamKeluar;
    if (status !== undefined) att.status = status;
    att.updatedAt = new Date();

    await db.attendance.update({ _id: att._id }, att);
    res.json({ success: true, message: 'Data berhasil diperbarui', data: att });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
