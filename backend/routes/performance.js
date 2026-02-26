const express = require('express');
const router = express.Router();
const PerformanceEvaluation = require('../models/PerformanceEvaluation');
const Attendance = require('../models/Attendance');
const WorkLog = require('../models/WorkLog');
const TargetSection = require('../models/TargetSection');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const { auth, adminOnly, superadminOnly } = require('../middleware/auth');

const DEBUG = process.env.NODE_ENV === 'development';

// ===== Helper: get working days in a month (excluding weekends + holidays) =====
async function getWorkingDays(bulan, tahun) {
  const startDate = new Date(tahun, bulan - 1, 1);
  const endDate = new Date(tahun, bulan, 0); // last day of month

  // Get holidays from attendance records
  const holidays = await Attendance.find({
    tanggal: { $gte: startDate, $lte: endDate },
    status: 'Hari Libur'
  }).distinct('tanggal');

  const holidayDates = new Set(holidays.map(d => new Date(d).toDateString()));

  const workingDays = [];
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const day = d.getDay();
    if (day !== 0 && day !== 6 && !holidayDates.has(d.toDateString())) {
      workingDays.push(new Date(d));
    }
  }

  return workingDays;
}

// ===== Helper: calculate absen for a user/month =====
async function calculateAbsen(userId, bulan, tahun) {
  const startDate = new Date(tahun, bulan - 1, 1);
  const endDate = new Date(tahun, bulan, 0);

  const workingDays = await getWorkingDays(bulan, tahun);
  const totalWorkingDays = workingDays.length;

  if (DEBUG) console.log(`[ABSEN DEBUG] User: ${userId}, Bulan: ${bulan}/${tahun}`);
  if (DEBUG) console.log(`[ABSEN DEBUG] Total working days: ${totalWorkingDays}`);

  if (totalWorkingDays === 0) {
    if (DEBUG) console.log('[ABSEN DEBUG] No working days, returning 0');
    return 0;
  }

  // Get all attendance records for the month
  const attendanceRecords = await Attendance.find({
    userId,
    tanggal: { $gte: startDate, $lte: endDate }
  });

  if (DEBUG) console.log(`[ABSEN DEBUG] Found ${attendanceRecords.length} attendance records`);

  // Calculate points per day
  let totalPoints = 0;

  for (const record of attendanceRecords) {
    const recordDate = new Date(record.tanggal).toDateString();
    const isWorkingDay = workingDays.some(d => d.toDateString() === recordDate);
    
    if (isWorkingDay) {
      let points = 0;
      if (record.status === 'Hadir') {
        points = 35;
        totalPoints += 35;
      } else if (record.status === 'Telat') {
        points = 30;
        totalPoints += 30;
      }
      if (DEBUG) console.log(`[ABSEN DEBUG] ${recordDate} - Status: ${record.status}, Points: ${points}`);
    } else {
      if (DEBUG) console.log(`[ABSEN DEBUG] ${recordDate} - NOT a working day (weekend/holiday)`);
    }
  }

  const avgPoints = totalPoints / totalWorkingDays;
  const absen = Math.min(parseFloat(avgPoints.toFixed(2)), 35);
  
  if (DEBUG) console.log(`[ABSEN DEBUG] Total points: ${totalPoints}, Avg: ${avgPoints}, Final absen: ${absen}%`);
  if (DEBUG) console.log('[ABSEN DEBUG] ==================');
  
  return absen;
}

// GET /api/performance/calculate/:userId — calculate absen + kuantitas for a user/month
router.get('/calculate/:userId', auth, adminOnly, async (req, res) => {
  try {
    const { userId } = req.params;
    const bulan = parseInt(req.query.bulan) || new Date().getMonth() + 1;
    const tahun = parseInt(req.query.tahun) || new Date().getFullYear();

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User tidak ditemukan.' });

    const startDate = new Date(tahun, bulan - 1, 1);
    const endDate = new Date(tahun, bulan, 0);

    // --- ABSEN (max 35%) ---
    // New system: per-day points
    // Hadir = 35 pts, Telat = 30 pts, Alpha/Izin/Sakit/Tidak Hadir = 0 pts
    const workingDays = await getWorkingDays(bulan, tahun);
    const totalWorkingDays = workingDays.length;

    // Get all attendance records for the month
    const attendanceRecords = await Attendance.find({
      userId,
      tanggal: { $gte: startDate, $lte: endDate }
    });

    // Calculate points per day
    let totalPoints = 0;
    let attendedDays = 0;

    for (const record of attendanceRecords) {
      const recordDate = new Date(record.tanggal).toDateString();
      // Check if this date is a working day
      const isWorkingDay = workingDays.some(d => d.toDateString() === recordDate);
      
      if (isWorkingDay) {
        attendedDays++;
        if (record.status === 'Hadir') {
          totalPoints += 35;
        } else if (record.status === 'Telat') {
          totalPoints += 30;
        }
        // Alpha, Izin, Sakit, Tidak Hadir = 0 points (no addition)
      }
    }

    // Average points per day (this is already the percentage 0-35)
    const avgPoints = totalWorkingDays > 0 ? totalPoints / totalWorkingDays : 0;
    
    // avgPoints is already the final score (0-35%)
    const absen = Math.min(parseFloat(avgPoints.toFixed(2)), 35);

    // --- KUANTITAS (manual input, no auto-calculation) ---
    // Admin will input this manually (0-30%)

    res.json({
      success: true,
      data: {
        userId,
        userName: user.name,
        bulan,
        tahun,
        absen,
        kuantitas: 0, // Default, will be set manually by admin
        detail: {
          totalWorkingDays,
          attendedDays,
          totalPoints,
          avgPoints: parseFloat(avgPoints.toFixed(2))
        }
      }
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/performance — save/update evaluation (draft or final)
router.post('/', auth, adminOnly, async (req, res) => {
  try {
    const { userId, bulan, tahun, kuantitas, kualitas, laporan, status } = req.body;
    // NOTE: absen is NOT saved - it's calculated dynamically from attendance data

    if (!userId || !bulan || !tahun) {
      return res.status(400).json({ success: false, message: 'userId, bulan, dan tahun wajib diisi.' });
    }

    const numKualitas = kualitas !== undefined && kualitas !== '' ? Number(kualitas) : 0;
    const numKuantitas = kuantitas !== undefined && kuantitas !== '' ? Number(kuantitas) : 0;

    if (numKualitas < 0 || numKualitas > 30) {
      return res.status(400).json({ success: false, message: 'Kualitas harus antara 0-30.' });
    }

    if (numKuantitas < 0 || numKuantitas > 30) {
      return res.status(400).json({ success: false, message: 'Kuantitas harus antara 0-30.' });
    }

    // Check if finalized evaluation already exists
    const existing = await PerformanceEvaluation.findOne({ userId, bulan, tahun });
    if (existing && existing.status === 'Final' && status !== 'Final') {
      return res.status(400).json({ success: false, message: 'Penilaian sudah difinalisasi dan tidak bisa diubah.' });
    }

    // Save only manual inputs (kuantitas, kualitas, laporan)
    // absen and hasil will be calculated dynamically when fetching
    const evaluation = await PerformanceEvaluation.findOneAndUpdate(
      { userId, bulan, tahun },
      {
        kuantitas: numKuantitas,
        kualitas: numKualitas,
        laporan: !!laporan,
        status: status || 'Draft',
        // absen and hasil are NOT saved - will be calculated on GET
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await evaluation.populate('userId', 'name email instansi');

    // Calculate absen and hasil dynamically for response
    // Guard against null userId (deleted user)
    const absen = evaluation.userId ? await calculateAbsen(userId, bulan, tahun) : 0;
    const laporanValue = laporan ? 5 : 0;
    const hasil = parseFloat((absen + numKuantitas + numKualitas + laporanValue).toFixed(2));

    // Add calculated fields to response
    const responseData = {
      ...evaluation.toObject(),
      absen,
      hasil
    };

    res.json({
      success: true,
      message: status === 'Final' ? 'Penilaian berhasil difinalisasi.' : 'Draft penilaian berhasil disimpan.',
      data: responseData
    });

  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'Penilaian untuk user ini di bulan tersebut sudah ada.' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/performance — list evaluations for a month
router.get('/', auth, adminOnly, async (req, res) => {
  try {
    const bulan = parseInt(req.query.bulan) || new Date().getMonth() + 1;
    const tahun = parseInt(req.query.tahun) || new Date().getFullYear();

    const evaluations = await PerformanceEvaluation.find({ bulan, tahun })
      .populate('userId', 'name email instansi');

    // Recalculate absen and hasil dynamically for each evaluation
    const evaluationsWithDynamicScores = await Promise.all(
      evaluations.map(async (ev) => {
        // Skip evaluations where the user has been deleted (populate returns null)
        if (!ev.userId) {
          return {
            ...ev.toObject(),
            absen: 0,
            hasil: 0,
            userId: { name: '[User Dihapus]', email: '', instansi: '' }
          };
        }
        const userId = typeof ev.userId === 'string' ? ev.userId : ev.userId._id;
        const absen = await calculateAbsen(userId, bulan, tahun);
        const laporanValue = ev.laporan ? 5 : 0;
        const hasil = parseFloat((absen + ev.kuantitas + ev.kualitas + laporanValue).toFixed(2));
        
        return {
          ...ev.toObject(),
          absen,
          hasil
        };
      })
    );

    // Sort by hasil descending
    evaluationsWithDynamicScores.sort((a, b) => b.hasil - a.hasil);

    res.json({ success: true, data: evaluationsWithDynamicScores });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/performance/ranking — finalized rankings
router.get('/ranking', auth, adminOnly, async (req, res) => {
  try {
    const bulan = parseInt(req.query.bulan) || new Date().getMonth() + 1;
    const tahun = parseInt(req.query.tahun) || new Date().getFullYear();

    const rankings = await PerformanceEvaluation.find({ bulan, tahun, status: 'Final' })
      .populate('userId', 'name email instansi');

    // Recalculate absen and hasil dynamically for each evaluation
    const rankingsWithDynamicScores = await Promise.all(
      rankings.map(async (ev) => {
        // Skip evaluations where the user has been deleted (populate returns null)
        if (!ev.userId) {
          return {
            ...ev.toObject(),
            absen: 0,
            hasil: 0,
            userId: { name: '[User Dihapus]', email: '', instansi: '' }
          };
        }
        const userId = typeof ev.userId === 'string' ? ev.userId : ev.userId._id;
        const absen = await calculateAbsen(userId, bulan, tahun);
        const laporanValue = ev.laporan ? 5 : 0;
        const hasil = parseFloat((absen + ev.kuantitas + ev.kualitas + laporanValue).toFixed(2));
        
        return {
          ...ev.toObject(),
          absen,
          hasil
        };
      })
    );

    // Sort by hasil descending
    rankingsWithDynamicScores.sort((a, b) => b.hasil - a.hasil);

    res.json({ success: true, data: rankingsWithDynamicScores });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/performance/:id/reset-to-draft — reset finalized evaluation back to Draft (superadmin)
router.put('/:id/reset-to-draft', auth, adminOnly, async (req, res) => {
  try {
    const evaluation = await PerformanceEvaluation.findById(req.params.id).populate('userId', 'name');
    if (!evaluation) {
      return res.status(404).json({ success: false, message: 'Penilaian tidak ditemukan.' });
    }
    
    // Only superadmin can reset Final evaluations
    if (evaluation.status === 'Final' && req.user.role !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'Hanya Superadmin yang dapat mereset penilaian final.' });
    }

    if (evaluation.status !== 'Final') {
      return res.status(400).json({ success: false, message: 'Penilaian ini belum difinalisasi.' });
    }

    const oldStatus = evaluation.status;
    evaluation.status = 'Draft';
    await evaluation.save();

    // Log Activity
    await ActivityLog.create({
      userId: req.userId,
      action: 'RESET_EVALUATION',
      targetId: evaluation._id,
      targetType: 'PerformanceEvaluation',
      details: `Reset penilaian ${evaluation.userId.name} (${evaluation.bulan}/${evaluation.tahun}) dari ${oldStatus} ke Draft`
    });

    if (DEBUG) console.log(`[RESET TO DRAFT] Evaluation ${req.params.id} reset from Final to Draft by ${req.user.name}`);

    res.json({ success: true, message: 'Penilaian berhasil direset ke Draft.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/performance/:id — delete evaluation
router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    const evaluation = await PerformanceEvaluation.findById(req.params.id).populate('userId', 'name');
    if (!evaluation) return res.status(404).json({ success: false, message: 'Penilaian tidak ditemukan.' });
    
    // If it's Final, only superadmin can delete
    if (evaluation.status === 'Final' && req.user.role !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'Penilaian final hanya bisa dihapus oleh Superadmin. Gunakan reset ke Draft jika perlu.' });
    }

    await PerformanceEvaluation.findByIdAndDelete(req.params.id);

    // Log Activity
    await ActivityLog.create({
      userId: req.userId,
      action: 'DELETE_EVALUATION',
      targetId: evaluation._id,
      targetType: 'PerformanceEvaluation',
      details: `Menghapus penilaian ${evaluation.userId.name} (${evaluation.bulan}/${evaluation.tahun}) - Status: ${evaluation.status}`
    });

    res.json({ success: true, message: `Penilaian ${evaluation.status === 'Final' ? 'final' : 'draft'} berhasil dihapus.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/performance/delete-all-finals — delete ALL finalized evaluations (superadmin only)
router.delete('/delete-all-finals/:bulan/:tahun', auth, superadminOnly, async (req, res) => {
  try {
    const bulan = parseInt(req.params.bulan);
    const tahun = parseInt(req.params.tahun);

    const result = await PerformanceEvaluation.deleteMany({ 
      bulan, 
      tahun, 
      status: 'Final' 
    });

    // Log Activity
    await ActivityLog.create({
      userId: req.userId,
      action: 'DELETE_ALL_FINALS',
      details: `Menghapus semua penilaian final untuk periode ${bulan}/${tahun} (Total: ${result.deletedCount})`
    });

    if (DEBUG) console.log(`[DELETE ALL FINALS] Deleted ${result.deletedCount} finalized evaluations for ${bulan}/${tahun} by ${req.user.name}`);

    res.json({ 
      success: true, 
      message: `Berhasil menghapus ${result.deletedCount} penilaian final.`,
      deletedCount: result.deletedCount
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
