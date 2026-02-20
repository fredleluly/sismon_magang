const router = require('express').Router();
const Attendance = require('../models/Attendance');
const QRCode = require('../models/QRCode');
const LateThreshold = require('../models/LateThreshold');
const User = require('../models/User');
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
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'absensi-' + uniqueSuffix + path.extname(file.originalname));
  },
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
  },
});

// Helper: Check if time is late
// Helper: Format time consistently as HH:MM (24h, colon-separated)
const formatTimeWIB = (date = new Date()) => {
  const d = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
};

const isLate = (timeStr, threshold = '08:00') => {
  try {
    const normalized = timeStr.replace('.', ':');
    const [hours, minutes] = normalized.split(':').map(Number);
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

    // For deleted users, use denormalized fields as fallback
    const data = records.map((r) => {
      const obj = r.toObject();
      if (!obj.userId && (obj.userName || obj.userEmail)) {
        obj.userId = {
          _id: r._doc.userId || '',
          name: obj.userName || 'Pengguna Dihapus',
          email: obj.userEmail || '-',
          instansi: obj.userInstansi || '-',
          _deleted: true,
        };
      }
      return obj;
    });

    res.json({ success: true, data });
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
    if (!qr)
      return res.status(400).json({
        success: false,
        message: 'QR Code tidak valid atau sudah expired.',
      });

    // Check if QR is for today
    const today = new Date().toISOString().split('T')[0];
    const qrDate = qr.tanggal.toISOString().split('T')[0];
    if (today !== qrDate) {
      return res.status(400).json({
        success: false,
        message: 'QR Code sudah expired (bukan untuk hari ini).',
      });
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
    const jamMasuk = formatTimeWIB(now);

    // Get late threshold for today (per-day from DB, or default)
    const todayThresholdDoc = await LateThreshold.findOne({ tanggal: today });
    const lateThreshold = todayThresholdDoc ? todayThresholdDoc.threshold : process.env.LATE_THRESHOLD || '08:00';

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

    // Save denormalized user info
    const scanUser = await User.findById(req.userId);
    if (scanUser) {
      attendance.userName = scanUser.name || '';
      attendance.userEmail = scanUser.email || '';
      attendance.userInstansi = scanUser.instansi || '';
      await attendance.save();
    }

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
    const existingAttendance = await Attendance.findOne({
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
      jamMasuk = formatTimeWIB(userDate);
    } else {
      const now = new Date();
      jamMasuk = formatTimeWIB(now);
    }

    // Get late threshold for today (per-day from DB, or default)
    const todayThresholdDoc2 = await LateThreshold.findOne({ tanggal: today });
    const lateThreshold = todayThresholdDoc2 ? todayThresholdDoc2.threshold : process.env.LATE_THRESHOLD || '08:00';
    const status = isLate(jamMasuk, lateThreshold) ? 'Telat' : 'Hadir';

    const fotoTimestamp = timestamp
      ? new Date(timestamp).toLocaleString('id-ID', {
          timeZone: timezone || 'Asia/Jakarta',
        })
      : new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

    // Prepare attendance data
    const attendanceUser = await User.findById(req.userId);
    const attendanceData = {
      userId: req.userId,
      tanggal: new Date(today),
      jamMasuk,
      jamKeluar: '',
      status,
      fotoTimestamp,
      userName: attendanceUser?.name || '',
      userEmail: attendanceUser?.email || '',
      userInstansi: attendanceUser?.instansi || '',
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

    const attendance = await Attendance.create(attendanceData);

    res.status(201).json({
      success: true,
      message: 'Absensi masuk dengan foto berhasil!',
      data: attendance,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'Anda sudah absen masuk hari ini.' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/attendance/photo-checkout — user takes photo to record checkout (pulang)
router.post('/photo-checkout', auth, upload.single('foto'), async (req, res) => {
  try {
    const { foto, timestamp, timezone, latitude, longitude, address, accuracy, keterangan } = req.body;

    if (!req.file && !foto) {
      return res.status(400).json({
        success: false,
        message: 'Foto wajib diambil untuk absensi pulang.',
      });
    }

    // Find today's attendance record
    const today = new Date().toISOString().split('T')[0];
    const attendance = await Attendance.findOne({
      userId: req.userId,
      tanggal: { $gte: new Date(today), $lt: new Date(today + 'T23:59:59') },
    });

    if (!attendance) {
      return res.status(400).json({
        success: false,
        message: 'Anda belum absen masuk hari ini. Silakan absen masuk terlebih dahulu.',
      });
    }

    if (attendance.jamKeluar && attendance.jamKeluar !== '' && attendance.jamKeluar !== '-') {
      return res.status(400).json({
        success: false,
        message: 'Anda sudah absen pulang hari ini.',
      });
    }

    // Use timestamp from user's device if provided, otherwise server time
    let jamKeluar;
    if (timestamp) {
      const userDate = new Date(timestamp);
      jamKeluar = formatTimeWIB(userDate);
    } else {
      const now = new Date();
      jamKeluar = formatTimeWIB(now);
    }

    const fotoPulangTimestamp = timestamp
      ? new Date(timestamp).toLocaleString('id-ID', {
          timeZone: timezone || 'Asia/Jakarta',
        })
      : new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

    attendance.jamKeluar = jamKeluar;
    attendance.fotoPulangTimestamp = fotoPulangTimestamp;
    attendance.locationPulang = {
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      address: address || '',
      accuracy: accuracy ? parseFloat(accuracy) : null,
    };

    if (keterangan) {
      attendance.keterangan = keterangan;
    }

    if (req.file) {
      attendance.fotoPulangUrl = `/uploads/${req.file.filename}`;
    } else if (foto) {
      attendance.fotoPulang = foto;
    }

    await attendance.save();

    res.json({
      success: true,
      message: 'Absensi pulang berhasil!',
      data: attendance,
    });
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
        size: req.file.size,
      },
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

    const att = await Attendance.findById(req.params.id);
    if (!att) return res.status(404).json({ success: false, message: 'Data absensi tidak ditemukan.' });

    att.status = status;

    // Update jamMasuk if provided (format: HH:MM)
    if (jamMasuk) {
      // Validate format
      if (!/^\d{2}:\d{2}$/.test(jamMasuk)) {
        return res.status(400).json({
          success: false,
          message: 'Format jam masuk harus HH:MM (contoh: 08:30)',
        });
      }
      att.jamMasuk = jamMasuk;
    }

    // Update jamKeluar if provided (format: HH:MM or empty string)
    if (jamKeluar !== undefined) {
      if (jamKeluar && !/^\d{2}:\d{2}$/.test(jamKeluar)) {
        return res.status(400).json({
          success: false,
          message: 'Format jam keluar harus HH:MM (contoh: 17:00)',
        });
      }
      att.jamKeluar = jamKeluar;
    }

    await att.save();

    // return populated user info for frontend convenience
    const populated = await Attendance.findById(att._id).populate('userId', 'name email instansi');

    res.json({
      success: true,
      message: 'Data absensi berhasil diperbarui.',
      data: populated,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/attendance/admin/set-status — admin: create or update a single user's attendance for a date
router.post('/admin/set-status', auth, adminOnly, async (req, res) => {
  try {
    const { userId, tanggal, status, jamMasuk, jamKeluar } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: 'userId wajib diisi.' });
    if (!tanggal) return res.status(400).json({ success: false, message: 'Tanggal wajib diisi.' });

    const allowed = ['Hadir', 'Telat', 'Izin', 'Sakit', 'Alpha', 'Libur', 'Hari Libur', 'Belum Absen'];
    if (!allowed.includes(status)) return res.status(400).json({ success: false, message: 'Status tidak valid.' });

    const dateStr = tanggal.split('T')[0];
    const targetDate = new Date(dateStr + 'T00:00:00');

    let att = await Attendance.findOne({
      userId,
      tanggal: {
        $gte: new Date(dateStr + 'T00:00:00'),
        $lt: new Date(dateStr + 'T23:59:59'),
      },
    });

    // Validate time formats if provided. Allow '-' for jamMasuk when status is 'Hari Libur'.
    if (jamMasuk && jamMasuk !== '-' && !/^\d{2}:\d{2}$/.test(jamMasuk)) {
      return res.status(400).json({
        success: false,
        message: 'Format jam masuk harus HH:MM (contoh: 08:30)',
      });
    }
    if (jamKeluar !== undefined && jamKeluar && !/^\d{2}:\d{2}$/.test(jamKeluar)) {
      return res.status(400).json({
        success: false,
        message: 'Format jam keluar harus HH:MM (contoh: 17:00)',
      });
    }

    if (att) {
      att.status = status;
      if (jamMasuk !== undefined) att.jamMasuk = jamMasuk;
      if (jamKeluar !== undefined) att.jamKeluar = jamKeluar;
      // Ensure denormalized user info is set
      if (!att.userName) {
        const targetUser = await User.findById(userId);
        if (targetUser) {
          att.userName = targetUser.name || '';
          att.userEmail = targetUser.email || '';
          att.userInstansi = targetUser.instansi || '';
        }
      }
      await att.save();
    } else {
      const targetUser = await User.findById(userId);
      const createData = {
        userId,
        tanggal: targetDate,
        jamMasuk: jamMasuk !== undefined ? jamMasuk : '',
        jamKeluar: jamKeluar !== undefined ? jamKeluar : '',
        status,
        userName: targetUser?.name || '',
        userEmail: targetUser?.email || '',
        userInstansi: targetUser?.instansi || '',
      };
      // For Hari Libur, follow bulk-holiday convention
      if (status === 'Hari Libur') {
        createData.jamMasuk = '-';
        createData.jamKeluar = '';
      }
      att = await Attendance.create(createData);
    }

    const populated = await Attendance.findById(att._id).populate('userId', 'name email instansi');
    res.json({
      success: true,
      message: 'Data absensi berhasil dibuat/diperbarui.',
      data: populated,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/attendance/bulk-holiday — admin: set all users to Hari Libur for a given date
router.post('/bulk-holiday', auth, adminOnly, async (req, res) => {
  try {
    const { tanggal } = req.body;
    if (!tanggal) return res.status(400).json({ success: false, message: 'Tanggal wajib diisi.' });

    const users = await User.find({ role: 'user' });

    const dateStr = new Date(tanggal).toISOString().split('T')[0];
    const targetDate = new Date(dateStr);

    let created = 0;
    let updated = 0;

    for (const user of users) {
      const existing = await Attendance.findOne({
        userId: user._id,
        tanggal: {
          $gte: new Date(dateStr),
          $lt: new Date(dateStr + 'T23:59:59'),
        },
      });

      if (existing) {
        existing.status = 'Hari Libur';
        existing.jamMasuk = '-';
        // Ensure denormalized user info
        if (!existing.userName) {
          existing.userName = user.name || '';
          existing.userEmail = user.email || '';
          existing.userInstansi = user.instansi || '';
        }
        await existing.save();
        updated++;
      } else {
        await Attendance.create({
          userId: user._id,
          tanggal: targetDate,
          jamMasuk: '-',
          jamKeluar: '',
          status: 'Hari Libur',
          userName: user.name || '',
          userEmail: user.email || '',
          userInstansi: user.instansi || '',
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
    const result = await Attendance.deleteMany({
      tanggal: {
        $gte: new Date(dateStr),
        $lt: new Date(dateStr + 'T23:59:59'),
      },
      status: 'Hari Libur',
    });

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
    const records = await Attendance.find({
      tanggal: { $gte: new Date(today), $lt: new Date(today + 'T23:59:59') },
    }).populate('userId', 'name email instansi');

    // For deleted users, use denormalized fields as fallback
    const data = records.map((r) => {
      const obj = r.toObject();
      if (!obj.userId && (obj.userName || obj.userEmail)) {
        obj.userId = {
          _id: r._doc.userId || '',
          name: obj.userName || 'Pengguna Dihapus',
          email: obj.userEmail || '-',
          instansi: obj.userInstansi || '-',
          _deleted: true,
        };
      }
      return obj;
    });

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/attendance/settings/late-threshold — get late threshold for a specific date (or today if not specified)
router.get('/settings/late-threshold', auth, async (req, res) => {
  try {
    const defaultThreshold = process.env.LATE_THRESHOLD || '08:00';
    // Support ?tanggal=YYYY-MM-DD query param, fallback to today
    const tanggal = req.query.tanggal || new Date().toISOString().split('T')[0];
    const doc = await LateThreshold.findOne({ tanggal });
    if (doc) {
      res.json({
        success: true,
        data: {
          lateThreshold: doc.threshold,
          isCustom: true,
          alasan: doc.alasan || '',
          tanggal,
          defaultThreshold,
        },
      });
    } else {
      res.json({
        success: true,
        data: {
          lateThreshold: defaultThreshold,
          isCustom: false,
          alasan: '',
          tanggal,
          defaultThreshold,
        },
      });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/attendance/settings/late-threshold — set default late threshold (admin only)
router.post('/settings/late-threshold', auth, adminOnly, async (req, res) => {
  try {
    const { threshold } = req.body;
    if (!threshold || !/^\d{2}:\d{2}$/.test(threshold)) {
      return res.status(400).json({
        success: false,
        message: 'Format threshold harus HH:MM (contoh: 08:00)',
      });
    }
    process.env.LATE_THRESHOLD = threshold;
    res.json({
      success: true,
      message: 'Late threshold default berhasil diubah',
      data: { lateThreshold: threshold },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/attendance/settings/today-threshold — set late threshold for a specific date (admin only)
router.post('/settings/today-threshold', auth, adminOnly, async (req, res) => {
  try {
    const { threshold, alasan, tanggal: reqTanggal } = req.body;
    if (!threshold || !/^\d{2}:\d{2}$/.test(threshold)) {
      return res.status(400).json({
        success: false,
        message: 'Format threshold harus HH:MM (contoh: 08:30)',
      });
    }
    // Support tanggal from body, fallback to today
    const tanggal = reqTanggal || new Date().toISOString().split('T')[0];
    const existing = await LateThreshold.findOne({ tanggal });
    if (existing) {
      existing.threshold = threshold;
      existing.alasan = alasan || '';
      await existing.save();
      return res.json({
        success: true,
        message: `Jam telat tanggal ${tanggal} berhasil diubah ke ${threshold}`,
        data: existing,
      });
    }
    const newDoc = await LateThreshold.create({
      tanggal,
      threshold,
      alasan: alasan || '',
    });
    res.json({
      success: true,
      message: `Jam telat tanggal ${tanggal} berhasil diatur ke ${threshold}`,
      data: newDoc,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/attendance/settings/today-threshold — reset threshold for a specific date back to default (admin only)
router.delete('/settings/today-threshold', auth, adminOnly, async (req, res) => {
  try {
    // Support ?tanggal=YYYY-MM-DD query param, fallback to today
    const tanggal = req.query.tanggal || new Date().toISOString().split('T')[0];
    const deleted = await LateThreshold.findOneAndDelete({ tanggal });
    const defaultThreshold = process.env.LATE_THRESHOLD || '08:00';
    if (!deleted) {
      return res.json({
        success: true,
        message: `Jam telat tanggal ${tanggal} sudah menggunakan default`,
        data: { lateThreshold: defaultThreshold },
      });
    }
    res.json({
      success: true,
      message: `Jam telat tanggal ${tanggal} dikembalikan ke default (${defaultThreshold})`,
      data: { lateThreshold: defaultThreshold },
    });
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

    res.json({
      success: true,
      data: { foto: fotoData, fotoTimestamp: att.fotoTimestamp },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/attendance/:id/photo-pulang — get checkout photo
router.get('/:id/photo-pulang', auth, async (req, res) => {
  try {
    const att = await Attendance.findById(req.params.id);
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

    res.json({
      success: true,
      data: { foto: fotoData, fotoTimestamp: att.fotoPulangTimestamp },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/attendance/:id/checkout — clock out (legacy, simple)
router.put('/:id/checkout', auth, async (req, res) => {
  try {
    const att = await Attendance.findById(req.params.id);
    if (!att) return res.status(404).json({ success: false, message: 'Data absensi tidak ditemukan.' });
    if (att.userId.toString() !== req.userId.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Akses ditolak.' });
    }

    const now = new Date();
    att.jamKeluar = formatTimeWIB(now);
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
