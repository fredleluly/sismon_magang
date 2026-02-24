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

const isLate = (timeStr, threshold = '08:10') => {
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
    let filter = {};
    if (req.user.role === 'admin' || req.user.role === 'superadmin') {
      // Find active user IDs to filter attendance
      const activeUsers = await User.find({ status: 'Aktif' }).select('_id');
      const activeUserIds = activeUsers.map(u => u._id);
      filter = { userId: { $in: activeUserIds } };
    } else {
      filter = { userId: req.userId };
    }

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
    if (req.user.status === 'Nonaktif') {
      return res.status(403).json({ success: false, message: 'Akun Anda tidak aktif. Tidak dapat melakukan absensi.' });
    }
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
    const lateThreshold = todayThresholdDoc ? todayThresholdDoc.threshold : process.env.LATE_THRESHOLD || '08:10';

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
    if (req.user.status === 'Nonaktif') {
      return res.status(403).json({ success: false, message: 'Akun Anda tidak aktif. Tidak dapat melakukan absensi.' });
    }
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
    const lateThreshold = todayThresholdDoc2 ? todayThresholdDoc2.threshold : process.env.LATE_THRESHOLD || '08:10';
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
    const targetDate = new Date(dateStr);

    let att = await Attendance.findOne({
      userId,
      tanggal: {
        $gte: new Date(dateStr),
        $lt: new Date(dateStr + 'T23:59:59.999Z'),
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
      if (!targetUser || targetUser.status === 'Nonaktif') {
        return res.status(400).json({ success: false, message: 'Tidak dapat mengatur absensi untuk peserta nonaktif.' });
      }
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

    const users = await User.find({ role: 'user', status: 'Aktif' });

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
    const activeUsers = await User.find({ status: 'Aktif' }).select('_id');
    const activeUserIds = activeUsers.map(u => u._id);

    const today = new Date().toISOString().split('T')[0];
    const records = await Attendance.find({
      userId: { $in: activeUserIds },
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
    const defaultThreshold = process.env.LATE_THRESHOLD || '08:10';
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
    const defaultThreshold = process.env.LATE_THRESHOLD || '08:10';
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

// =============================================
// CLEANUP PHOTOS — HTML Page + API (no auth)
// =============================================

// GET /api/attendance/cleanup-photos — serves HTML page for photo cleanup
router.get('/cleanup-photos', (req, res) => {
  const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cleanup Foto Absensi</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .card {
      background: linear-gradient(135deg, #1e293b 0%, #1a2332 100%);
      border: 1px solid #334155;
      border-radius: 16px;
      padding: 32px;
      max-width: 520px;
      width: 100%;
      box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
    }
    .header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 24px;
    }
    .header .icon {
      width: 48px; height: 48px;
      background: linear-gradient(135deg, #ef4444, #dc2626);
      border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
      font-size: 24px;
    }
    .header h1 { font-size: 20px; font-weight: 700; color: #f1f5f9; }
    .header p { font-size: 13px; color: #94a3b8; margin-top: 2px; }
    .info-box {
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 10px;
      padding: 16px;
      margin-bottom: 20px;
      font-size: 13px;
      line-height: 1.6;
      color: #94a3b8;
    }
    .info-box strong { color: #60a5fa; }
    .form-group {
      margin-bottom: 16px;
    }
    .form-group label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: #94a3b8;
      margin-bottom: 6px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .form-group input {
      width: 100%;
      padding: 10px 14px;
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 8px;
      color: #e2e8f0;
      font-size: 14px;
      font-family: 'Inter', sans-serif;
      transition: border-color 0.2s;
    }
    .form-group input:focus {
      outline: none;
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59,130,246,0.15);
    }
    .date-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .btn-preview {
      width: 100%;
      padding: 10px;
      background: #1e40af;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      margin-bottom: 12px;
    }
    .btn-preview:hover { background: #1d4ed8; transform: translateY(-1px); }
    .btn-preview:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
    .btn-delete {
      width: 100%;
      padding: 12px;
      background: linear-gradient(135deg, #dc2626, #b91c1c);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s;
      display: none;
    }
    .btn-delete:hover { background: linear-gradient(135deg, #ef4444, #dc2626); transform: translateY(-1px); }
    .btn-delete:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
    .preview-result {
      background: #172033;
      border: 1px solid #334155;
      border-radius: 10px;
      padding: 16px;
      margin-bottom: 16px;
      display: none;
    }
    .preview-result h3 {
      font-size: 14px;
      font-weight: 600;
      color: #fbbf24;
      margin-bottom: 10px;
    }
    .stat { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }
    .stat .label { color: #94a3b8; }
    .stat .value { color: #f1f5f9; font-weight: 600; }
    .result-box {
      background: #172033;
      border-radius: 10px;
      padding: 16px;
      margin-top: 16px;
      display: none;
    }
    .result-box.success { border: 1px solid #22c55e; }
    .result-box.error { border: 1px solid #ef4444; }
    .result-box h3 { font-size: 14px; margin-bottom: 8px; }
    .result-box.success h3 { color: #22c55e; }
    .result-box.error h3 { color: #ef4444; }
    .result-box p { font-size: 13px; color: #94a3b8; line-height: 1.5; }
    .btn-download {
      width: 100%;
      padding: 12px;
      background: linear-gradient(135deg, #059669, #047857);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s;
      margin-bottom: 20px;
    }
    .btn-download:hover { background: linear-gradient(135deg, #10b981, #059669); transform: translateY(-1px); }
    .btn-download:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
    .divider {
      border: none;
      border-top: 1px solid #334155;
      margin: 20px 0;
    }
    .spinner {
      display: inline-block;
      width: 16px; height: 16px;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
      margin-right: 8px;
      vertical-align: middle;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="icon">🗑️</div>
      <div>
        <h1>Cleanup Foto Absensi</h1>
        <p>Hapus foto absensi masuk &amp; keluar dari database</p>
      </div>
    </div>

    <div class="info-box">
      <strong>ℹ️ Cara kerja:</strong><br>
      Foto absensi (masuk &amp; keluar) dalam rentang tanggal yang dipilih akan dihapus dari database dan disk.
      <strong>Data absensi (jam, status, dll) tetap aman</strong> — hanya foto yang dihapus.
    </div>

    <button class="btn-download" id="btnDownload" onclick="downloadAll()">
      \u2b07\ufe0f Backup Database (ZIP)
    </button>

    <hr class="divider">

    <div class="date-row">
      <div class="form-group">
        <label>📅 Dari Tanggal</label>
        <input type="date" id="fromDate">
      </div>
      <div class="form-group">
        <label>📅 Sampai Tanggal</label>
        <input type="date" id="toDate">
      </div>
    </div>

    <button class="btn-preview" id="btnPreview" onclick="previewCleanup()">
      🔍 Preview — Lihat Data yang Terdampak
    </button>

    <div class="preview-result" id="previewResult">
      <h3>⚠️ Data yang akan dihapus fotonya:</h3>
      <div class="stat"><span class="label">Jumlah record:</span><span class="value" id="previewCount">0</span></div>
      <div class="stat"><span class="label">Foto masuk (base64):</span><span class="value" id="previewMasukB64">0</span></div>
      <div class="stat"><span class="label">Foto masuk (file):</span><span class="value" id="previewMasukFile">0</span></div>
      <div class="stat"><span class="label">Foto pulang (base64):</span><span class="value" id="previewPulangB64">0</span></div>
      <div class="stat"><span class="label">Foto pulang (file):</span><span class="value" id="previewPulangFile">0</span></div>
      <div class="stat"><span class="label">Rentang:</span><span class="value" id="previewRange">-</span></div>
    </div>

    <button class="btn-delete" id="btnDelete" onclick="executeCleanup()">
      🗑️ HAPUS FOTO SEKARANG
    </button>

    <div class="result-box" id="resultBox">
      <h3 id="resultTitle"></h3>
      <p id="resultMessage"></p>
    </div>
  </div>

  <script>
    const today = new Date();
    const wibNow = new Date(today.getTime() + 7 * 60 * 60 * 1000);
    const dayBeforeYesterday = new Date(wibNow);
    dayBeforeYesterday.setUTCDate(dayBeforeYesterday.getUTCDate() - 2);
    const toDateStr = dayBeforeYesterday.toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(wibNow);
    thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);
    const fromDateStr = thirtyDaysAgo.toISOString().split('T')[0];

    document.getElementById('fromDate').value = fromDateStr;
    document.getElementById('toDate').value = toDateStr;

    const API_BASE = window.location.origin + '/api/attendance/cleanup-photos';

    async function previewCleanup() {
      const from = document.getElementById('fromDate').value;
      const to = document.getElementById('toDate').value;
      if (!from || !to) { alert('Pilih rentang tanggal!'); return; }

      const btn = document.getElementById('btnPreview');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span>Memuat preview...';

      try {
        const resp = await fetch(API_BASE + '/preview?from=' + from + '&to=' + to);
        const data = await resp.json();

        if (!data.success) {
          alert('Error: ' + data.message);
          return;
        }

        const d = data.data;
        document.getElementById('previewCount').textContent = d.totalRecords;
        document.getElementById('previewMasukB64').textContent = d.fotoMasukBase64;
        document.getElementById('previewMasukFile').textContent = d.fotoMasukFile;
        document.getElementById('previewPulangB64').textContent = d.fotoPulangBase64;
        document.getElementById('previewPulangFile').textContent = d.fotoPulangFile;
        document.getElementById('previewRange').textContent = from + '  →  ' + to;

        document.getElementById('previewResult').style.display = 'block';
        document.getElementById('btnDelete').style.display = d.totalRecords > 0 ? 'block' : 'none';
        document.getElementById('resultBox').style.display = 'none';
      } catch (err) {
        alert('Gagal preview: ' + err.message);
      } finally {
        btn.disabled = false;
        btn.innerHTML = '🔍 Preview — Lihat Data yang Terdampak';
      }
    }

    async function executeCleanup() {
      if (!confirm('⚠️ YAKIN hapus foto absensi dalam rentang ini?\\nAksi ini TIDAK BISA dibatalkan!')) return;

      const from = document.getElementById('fromDate').value;
      const to = document.getElementById('toDate').value;

      const btn = document.getElementById('btnDelete');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span>Menghapus foto...';

      try {
        const resp = await fetch(API_BASE + '?from=' + from + '&to=' + to, {
          method: 'DELETE',
        });
        const data = await resp.json();

        const resultBox = document.getElementById('resultBox');
        const resultTitle = document.getElementById('resultTitle');
        const resultMessage = document.getElementById('resultMessage');

        if (data.success) {
          resultBox.className = 'result-box success';
          resultTitle.textContent = '✅ Berhasil!';
          resultMessage.textContent = data.message;
          document.getElementById('btnDelete').style.display = 'none';
          document.getElementById('previewResult').style.display = 'none';
        } else {
          resultBox.className = 'result-box error';
          resultTitle.textContent = '❌ Gagal';
          resultMessage.textContent = data.message;
        }
        resultBox.style.display = 'block';
      } catch (err) {
        alert('Error: ' + err.message);
      } finally {
        btn.disabled = false;
        btn.innerHTML = '🗑️ HAPUS FOTO SEKARANG';
      }
    }

    async function downloadAll() {
      const btn = document.getElementById('btnDownload');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span>Mengambil daftar foto...';

      try {
        const resp = await fetch(window.location.origin + '/api/attendance/cleanup-photos/list-images');
        const data = await resp.json();
        if (!data.success) { alert('Error: ' + data.message); return; }

        const images = data.data;
        if (images.length === 0) { alert('Tidak ada foto di database.'); return; }

        btn.innerHTML = '<span class="spinner"></span>Downloading 0/' + images.length + '...';

        for (let i = 0; i < images.length; i++) {
          btn.innerHTML = '<span class="spinner"></span>Downloading ' + (i + 1) + '/' + images.length + '...';
          const img = images[i];
          try {
            const a = document.createElement('a');
            a.href = img.url;
            a.download = img.filename;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            a.remove();
            // Small delay to avoid browser blocking multiple downloads
            await new Promise(r => setTimeout(r, 300));
          } catch (e) { console.error('Failed to download:', img.filename, e); }
        }

        alert('Selesai! ' + images.length + ' foto di-download.');
      } catch (err) {
        alert('Download gagal: ' + err.message);
      } finally {
        btn.disabled = false;
        btn.innerHTML = '\u2b07\ufe0f Backup Database (ZIP)';
      }
    }
  </script>
</body>
</html>`;
  res.type('html').send(html);
});

// GET /api/attendance/cleanup-photos/list-images — returns list of all image URLs (no auth)
router.get('/cleanup-photos/list-images', async (req, res) => {
  try {
    const records = await Attendance.find({
      $or: [
        { fotoAbsensi: { $ne: '' } },
        { fotoUrl: { $ne: '' } },
        { fotoPulang: { $ne: '' } },
        { fotoPulangUrl: { $ne: '' } },
      ],
    });

    const images = [];
    const baseUrl = req.protocol + '://' + req.get('host');

    for (const record of records) {
      const dateStr = record.tanggal ? record.tanggal.toISOString().split('T')[0] : 'unknown';
      const userName = (record.userName || 'unknown').replace(/[^a-zA-Z0-9_\-]/g, '_');

      if (record.fotoAbsensi) {
        images.push({
          url: baseUrl + '/api/attendance/cleanup-photos/image/' + record._id + '/masuk',
          filename: dateStr + '_' + userName + '_masuk.jpg',
        });
      }
      if (record.fotoUrl) {
        images.push({
          url: baseUrl + record.fotoUrl,
          filename: dateStr + '_' + userName + '_masuk_file' + path.extname(record.fotoUrl),
        });
      }
      if (record.fotoPulang) {
        images.push({
          url: baseUrl + '/api/attendance/cleanup-photos/image/' + record._id + '/pulang',
          filename: dateStr + '_' + userName + '_pulang.jpg',
        });
      }
      if (record.fotoPulangUrl) {
        images.push({
          url: baseUrl + record.fotoPulangUrl,
          filename: dateStr + '_' + userName + '_pulang_file' + path.extname(record.fotoPulangUrl),
        });
      }
    }

    res.json({ success: true, data: images });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/attendance/cleanup-photos/image/:id/:type — serve base64 image as downloadable file (no auth)
router.get('/cleanup-photos/image/:id/:type', async (req, res) => {
  try {
    const record = await Attendance.findById(req.params.id);
    if (!record) return res.status(404).json({ success: false, message: 'Record tidak ditemukan.' });

    const type = req.params.type; // 'masuk' or 'pulang'
    let b64 = type === 'pulang' ? record.fotoPulang : record.fotoAbsensi;

    if (!b64) return res.status(404).json({ success: false, message: 'Foto tidak ditemukan.' });

    // Parse base64
    let mimeType = 'image/jpeg';
    let base64Data = b64;
    if (b64.startsWith('data:')) {
      const match = b64.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        base64Data = match[2];
      } else {
        base64Data = b64.split(',')[1] || b64;
      }
    }

    const buffer = Buffer.from(base64Data, 'base64');
    const ext = mimeType.includes('png') ? '.png' : '.jpg';
    const dateStr = record.tanggal ? record.tanggal.toISOString().split('T')[0] : 'unknown';
    const userName = (record.userName || 'unknown').replace(/[^a-zA-Z0-9_\-]/g, '_');
    const filename = dateStr + '_' + userName + '_' + type + ext;

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"');
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/attendance/cleanup-photos/preview — preview affected records (no auth)
router.get('/cleanup-photos/preview', async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) {
      return res.status(400).json({ success: false, message: 'Parameter from dan to wajib diisi (format YYYY-MM-DD).' });
    }

    const fromDate = new Date(from);
    const toDate = new Date(to + 'T23:59:59.999Z');

    const records = await Attendance.find({
      tanggal: { $gte: fromDate, $lte: toDate },
      $or: [
        { fotoAbsensi: { $ne: '' } },
        { fotoUrl: { $ne: '' } },
        { fotoPulang: { $ne: '' } },
        { fotoPulangUrl: { $ne: '' } },
      ],
    });

    let fotoMasukBase64 = 0, fotoMasukFile = 0, fotoPulangBase64 = 0, fotoPulangFile = 0;
    for (const r of records) {
      if (r.fotoAbsensi) fotoMasukBase64++;
      if (r.fotoUrl) fotoMasukFile++;
      if (r.fotoPulang) fotoPulangBase64++;
      if (r.fotoPulangUrl) fotoPulangFile++;
    }

    res.json({
      success: true,
      data: {
        totalRecords: records.length,
        fotoMasukBase64,
        fotoMasukFile,
        fotoPulangBase64,
        fotoPulangFile,
        from,
        to,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/attendance/cleanup-photos — remove photo data from attendance records (no auth)
// Supports ?from=YYYY-MM-DD&to=YYYY-MM-DD query params for custom date range
router.delete('/cleanup-photos', async (req, res) => {
  try {
    const { from, to } = req.query;
    let dateFilter;

    if (from && to) {
      dateFilter = {
        $gte: new Date(from),
        $lte: new Date(to + 'T23:59:59.999Z'),
      };
    } else {
      const now = new Date();
      const wibOffset = 7 * 60 * 60 * 1000;
      const nowWIB = new Date(now.getTime() + wibOffset);
      const yesterdayWIB = new Date(nowWIB);
      yesterdayWIB.setUTCDate(yesterdayWIB.getUTCDate() - 1);
      yesterdayWIB.setUTCHours(0, 0, 0, 0);
      const cutoffUTC = new Date(yesterdayWIB.getTime() - wibOffset);
      dateFilter = { $lt: cutoffUTC };
    }

    const records = await Attendance.find({
      tanggal: dateFilter,
      $or: [
        { fotoAbsensi: { $ne: '' } },
        { fotoUrl: { $ne: '' } },
        { fotoPulang: { $ne: '' } },
        { fotoPulangUrl: { $ne: '' } },
      ],
    });

    let cleanedCount = 0;
    let filesDeleted = 0;

    for (const record of records) {
      const filesToDelete = [record.fotoUrl, record.fotoPulangUrl].filter(Boolean);
      for (const fileUrl of filesToDelete) {
        try {
          const filePath = path.join(__dirname, '..', fileUrl);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            filesDeleted++;
          }
        } catch (fileErr) {
          console.error('Failed to delete file ' + fileUrl + ':', fileErr.message);
        }
      }

      record.fotoAbsensi = '';
      record.fotoUrl = '';
      record.fotoPulang = '';
      record.fotoPulangUrl = '';
      await record.save();
      cleanedCount++;
    }

    res.json({
      success: true,
      message: 'Foto absensi berhasil dibersihkan. ' + cleanedCount + ' record dibersihkan, ' + filesDeleted + ' file dihapus.',
      data: {
        recordsCleaned: cleanedCount,
        filesDeleted,
      },
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
    if (att.userId.toString() !== req.userId.toString() && req.user.role !== 'admin' && req.user.role !== 'superadmin') {
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

    if (att.userId.toString() !== req.userId.toString() && req.user.role !== 'admin' && req.user.role !== 'superadmin') {
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
    if (att.userId.toString() !== req.userId.toString() && req.user.role !== 'admin' && req.user.role !== 'superadmin') {
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
