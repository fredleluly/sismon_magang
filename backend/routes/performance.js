const express = require('express');
const router = express.Router();
// const PerformanceEvaluation = require('../models/PerformanceEvaluation');
// const Attendance = require('../models/Attendance');
// const WorkLog = require('../models/WorkLog');
// const TargetSection = require('../models/TargetSection');
// const User = require('../models/User');
const db = require('../db');
const { auth, adminOnly } = require('../middleware/auth');

// ===== Helper: get working days in a month (excluding weekends + holidays) =====
async function getWorkingDays(bulan, tahun) {
  const startDate = new Date(tahun, bulan - 1, 1);
  const endDate = new Date(tahun, bulan, 0); // last day of month

  // Get holidays from attendance records
  // Get holidays from attendance records
  const holidays = await db.attendance.find({
    tanggal: { $gte: startDate, $lte: endDate },
    status: 'Hari Libur'
  }); // .distinct('tanggal') is not available in NeDB

  const holidayDates = new Set(holidays.map(d => new Date(d.tanggal).toDateString()));

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

  console.log(`[ABSEN DEBUG] User: ${userId}, Bulan: ${bulan}/${tahun}`);
  console.log(`[ABSEN DEBUG] Total working days: ${totalWorkingDays}`);

  if (totalWorkingDays === 0) {
    console.log('[ABSEN DEBUG] No working days, returning 0');
    return 0;
  }

  // Get all attendance records for the month
  // Get all attendance records for the month
  const attendanceRecords = await db.attendance.find({
    userId,
    tanggal: { $gte: startDate, $lte: endDate }
  });

  console.log(`[ABSEN DEBUG] Found ${attendanceRecords.length} attendance records`);

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
      console.log(`[ABSEN DEBUG] ${recordDate} - Status: ${record.status}, Points: ${points}`);
    } else {
      console.log(`[ABSEN DEBUG] ${recordDate} - NOT a working day (weekend/holiday)`);
    }
  }

  const avgPoints = totalPoints / totalWorkingDays;
  const absen = Math.min(parseFloat(avgPoints.toFixed(2)), 35);
  
  console.log(`[ABSEN DEBUG] Total points: ${totalPoints}, Avg: ${avgPoints}, Final absen: ${absen}%`);
  console.log('[ABSEN DEBUG] ==================');
  
  return absen;
}

// GET /api/performance/calculate/:userId — calculate absen + kuantitas for a user/month
router.get('/calculate/:userId', auth, adminOnly, async (req, res) => {
  try {
    const { userId } = req.params;
    const bulan = parseInt(req.query.bulan) || new Date().getMonth() + 1;
    const tahun = parseInt(req.query.tahun) || new Date().getFullYear();

    const user = await db.users.findOne({ _id: userId });
    if (!user) return res.status(404).json({ success: false, message: 'User tidak ditemukan.' });

    const startDate = new Date(tahun, bulan - 1, 1);
    const endDate = new Date(tahun, bulan, 0);

    // --- ABSEN (max 35%) ---
    // New system: per-day points
    // Hadir = 35 pts, Telat = 30 pts, Alpha/Izin/Sakit/Tidak Hadir = 0 pts
    const workingDays = await getWorkingDays(bulan, tahun);
    const totalWorkingDays = workingDays.length;

    // Get all attendance records for the month
    // Get all attendance records for the month
    const attendanceRecords = await db.attendance.find({
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

    if (kualitas !== undefined && (kualitas < 0 || kualitas > 30)) {
      return res.status(400).json({ success: false, message: 'Kualitas harus antara 0-30.' });
    }

    if (kuantitas !== undefined && (kuantitas < 0 || kuantitas > 30)) {
      return res.status(400).json({ success: false, message: 'Kuantitas harus antara 0-30.' });
    }

    // Check if finalized evaluation already exists
    // Check if finalized evaluation already exists
    let existing = await db.performance.findOne({ userId, bulan, tahun });
    if (existing && existing.status === 'Final' && status !== 'Final') {
      return res.status(400).json({ success: false, message: 'Penilaian sudah difinalisasi dan tidak bisa diubah.' });
    }

    // Save only manual inputs (kuantitas, kualitas, laporan)
    const updateData = {
        userId, bulan, tahun,
        kuantitas: kuantitas || 0,
        kualitas: kualitas || 0,
        laporan: !!laporan,
        status: status || 'Draft',
        updatedAt: new Date()
    };
    
    let evaluation;
    if (existing) {
        await db.performance.update({ _id: existing._id }, { $set: updateData });
        evaluation = await db.performance.findOne({ _id: existing._id });
    } else {
        updateData.createdAt = new Date();
        evaluation = await db.performance.insert(updateData);
    }
    
    // Manual populate
    const user = await db.users.findOne({ _id: userId });
    evaluation.userId = user ? { _id: user._id, name: user.name, email: user.email, instansi: user.instansi } : null;

    // Calculate absen and hasil dynamically for response
    const absen = await calculateAbsen(userId, bulan, tahun);
    const laporanValue = laporan ? 5 : 0;
    const hasil = parseFloat((absen + (kuantitas || 0) + (kualitas || 0) + laporanValue).toFixed(2));

    // Add calculated fields to response
    // Add calculated fields to response
    const responseData = {
      ...evaluation, // already object
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

    let evaluations = await db.performance.find({ bulan, tahun });
    
    // Manual populate
     evaluations = await Promise.all(evaluations.map(async (ev) => {
        const user = await db.users.findOne({ _id: ev.userId });
        return { 
            ...ev, 
            userId: user ? { _id: user._id, name: user.name, email: user.email, instansi: user.instansi } : ev.userId 
        };
    }));

    // Recalculate absen and hasil dynamically for each evaluation
    const evaluationsWithDynamicScores = await Promise.all(
      evaluations.map(async (ev) => {
        const userId = typeof ev.userId === 'string' ? ev.userId : ev.userId._id;
        const absen = await calculateAbsen(userId, bulan, tahun);
        const laporanValue = ev.laporan ? 5 : 0;
        const hasil = parseFloat((absen + ev.kuantitas + ev.kualitas + laporanValue).toFixed(2));
        
        return {
          ...ev,
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

    let rankings = await db.performance.find({ bulan, tahun, status: 'Final' });
    
     // Manual populate
     rankings = await Promise.all(rankings.map(async (ev) => {
        const user = await db.users.findOne({ _id: ev.userId });
        return { 
            ...ev, 
            userId: user ? { _id: user._id, name: user.name, email: user.email, instansi: user.instansi } : ev.userId 
        };
    }));

    // Recalculate absen and hasil dynamically for each evaluation
    const rankingsWithDynamicScores = await Promise.all(
      rankings.map(async (ev) => {
        const userId = typeof ev.userId === 'string' ? ev.userId : ev.userId._id;
        const absen = await calculateAbsen(userId, bulan, tahun);
        const laporanValue = ev.laporan ? 5 : 0;
        const hasil = parseFloat((absen + ev.kuantitas + ev.kualitas + laporanValue).toFixed(2));
        
        return {
          ...ev,
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

// DELETE /api/performance/:id — delete draft evaluation
router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    const evaluation = await db.performance.findOne({ _id: req.params.id });
    if (!evaluation) return res.status(404).json({ success: false, message: 'Penilaian tidak ditemukan.' });
    if (evaluation.status === 'Final') {
      return res.status(400).json({ success: false, message: 'Penilaian final tidak bisa dihapus.' });
    }
    await db.performance.remove({ _id: req.params.id }, { multi: false });
    res.json({ success: true, message: 'Penilaian draft berhasil dihapus.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/performance/delete-all-finals — delete ALL finalized evaluations (for testing)
router.delete('/delete-all-finals/:bulan/:tahun', auth, adminOnly, async (req, res) => {
  try {
    const bulan = parseInt(req.params.bulan);
    const tahun = parseInt(req.params.tahun);

    // NeDB remove returns number of removed documents
    const numRemoved = await db.performance.remove({ 
      bulan, 
      tahun, 
      status: 'Final' 
    }, { multi: true });

    const result = { deletedCount: numRemoved };

    console.log(`[DELETE ALL FINALS] Deleted ${result.deletedCount} finalized evaluations for ${bulan}/${tahun}`);

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
