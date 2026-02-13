const router = require('express').Router();
const User = require('../models/User');
const WorkLog = require('../models/WorkLog');
const Attendance = require('../models/Attendance');
const Complaint = require('../models/Complaint');
const { auth, adminOnly } = require('../middleware/auth');

// GET /api/dashboard/admin — admin dashboard stats
router.get('/admin', auth, adminOnly, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const totalPeserta = await User.countDocuments({ role: 'user' });

    // Total completed work
    const workStats = await WorkLog.aggregate([
      { $match: { status: 'Selesai' } },
      { $group: { _id: null, total: { $sum: 1 }, berkas: { $sum: '$berkas' }, buku: { $sum: '$buku' }, bundle: { $sum: '$bundle' } } }
    ]);
    const ws = workStats[0] || { total: 0, berkas: 0, buku: 0, bundle: 0 };

    // Today's attendance
    const todayAttendance = await Attendance.countDocuments({
      tanggal: { $gte: new Date(today), $lt: new Date(today + 'T23:59:59') }
    });

    // Attendance rate
    const attendanceRate = totalPeserta > 0 ? Math.round((todayAttendance / totalPeserta) * 100) : 0;

    // Average productivity (items per person)
    const avgProductivity = totalPeserta > 0 ? Math.round((ws.berkas + ws.buku + ws.bundle) / totalPeserta) : 0;

    // Top 5 performers
    const topPerformers = await WorkLog.aggregate([
      { $match: { status: 'Selesai' } },
      { $group: { _id: '$userId', totalItems: { $sum: { $add: ['$berkas', '$buku', '$bundle'] } } } },
      { $sort: { totalItems: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' },
      { $project: { name: '$user.name', totalItems: 1 } }
    ]);

    const { startDate, endDate } = req.query;
    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = {
        tanggal: {
          $gte: new Date(startDate),
          $lte: new Date(endDate + 'T23:59:59')
        }
      };
    }

    // Specific totals by jenis (Filtered)
    const specificStats = await WorkLog.aggregate([
      { $match: { status: 'Selesai', ...dateFilter } },
      { 
        $group: { 
          _id: '$jenis', 
          count: { $sum: 1 },
          totalItems: { $sum: { $add: ['$berkas', '$buku', '$bundle'] } } 
        } 
      }
    ]);

    // Register specific breakdown
    const registerStatsAgg = await WorkLog.aggregate([
      { $match: { status: 'Selesai', jenis: 'Register', ...dateFilter } },
      { 
        $group: { 
          _id: null, 
          berkas: { $sum: '$berkas' }, 
          buku: { $sum: '$buku' }, 
          bundle: { $sum: '$bundle' }
        } 
      }
    ]);
    const registerStats = registerStatsAgg[0] || { berkas: 0, buku: 0, bundle: 0 };

    const getStat = (jenis) => {
      const found = specificStats.find(s => s._id === jenis);
      return found ? found.totalItems : 0;
    };

    const totalSortir = getStat('Sortir');
    const totalSteples = getStat('Pencopotan Steples');
    const totalScanning = getStat('Scanning');
    const totalRegister = getStat('Register');
    const totalStikering = getStat('Stikering');
    
    // Rekardus stats (Filtered)
    const totalRekardus = getStat('Rekardus');

    // Chart Data (Filtered) - previously weeklyProgress
    // If filtered, show data within range. If not, default to last 2 weeks?
    // User requested filters apply to chart.
    // If no filter, we can keep default behavior or apply default range in frontend.
    // Let's assume frontend sends dates. If not, we default to last 2 weeks here or just return all?
    // Better to use the dateFilter if present, else default.
    let chartMatch = { status: 'Selesai', jenis: 'Rekardus' };
    if (startDate && endDate) {
      chartMatch = { ...chartMatch, ...dateFilter };
    } else {
       const twoWeeksAgo = new Date();
       twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
       chartMatch.tanggal = { $gte: twoWeeksAgo };
    }

    const chartData = await WorkLog.aggregate([
      { $match: chartMatch },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$tanggal' } },
          berkas: { $sum: '$berkas' }, buku: { $sum: '$buku' }, bundle: { $sum: '$bundle' },
          total: { $sum: { $add: ['$berkas', '$buku', '$bundle'] } }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Work distribution by jenis (Filtered)
    const workDistribution = await WorkLog.aggregate([
      { $match: { status: 'Selesai', ...dateFilter } },
      { $group: { _id: '$jenis', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Recent activity (Not necessarily filtered by date for dashboard view, usually just latest)
    // But maybe user wants to see activity in that range?
    // Usually "Recent Activity" feed stays "Recent". Let's keep it latest.
    const recentActivity = await WorkLog.find({ status: 'Selesai' })
      .populate('userId', 'name')
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      success: true,
      data: {
        totalPeserta,
        totalPekerjaanSelesai: ws.total, // This is total ALL TIME usually, unless we want to filter this too?
        // Let's align "Total Pekerjaan Selesai" with the filter too if requested "filter tersebut untuk 5 stat grid... dan juga untuk donut chart".
        // The 5 stat grid is handled. Donut chart is workDistribution (handled).
        // Area chart is chartData (handled).
        
        // These legacy totals might be less relevant now but keeping them safe.
        totalBerkas: ws.berkas, 
        totalBuku: ws.buku,
        totalBundle: ws.bundle,
        
        // New specific stats
        totalSortir,
        totalSteples,
        totalScanning,
        totalRegister,
        totalStikering,
        totalRekardus,
        registerStats, // New specific stats for donut chart

        todayAttendance,
        attendanceRate,
        avgProductivity,
        topPerformers,
        weeklyProgress: chartData, // reuse field name to avoid frontend break, or rename? 
        // Frontend expects weeklyProgress for the chart. Let's keep the key but it contains filtered data.
        workDistribution,
        recentActivity
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/dashboard/user — user dashboard stats
router.get('/user', auth, async (req, res) => {
  try {
    const stats = await WorkLog.aggregate([
      { $match: { userId: req.userId, status: 'Selesai' } },
      { $group: { _id: null, berkas: { $sum: '$berkas' }, buku: { $sum: '$buku' }, bundle: { $sum: '$bundle' } } }
    ]);
    const s = stats[0] || { berkas: 0, buku: 0, bundle: 0 };

    // Pending count
    const pendingCount = await WorkLog.countDocuments({ userId: req.userId, status: 'Draft' });

    // Weekly progress
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const weeklyProgress = await WorkLog.aggregate([
      { $match: { userId: req.userId, status: 'Selesai', tanggal: { $gte: oneWeekAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$tanggal' } },
          berkas: { $sum: '$berkas' }, buku: { $sum: '$buku' }, bundle: { $sum: '$bundle' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Work distribution
    const workDistribution = await WorkLog.aggregate([
      { $match: { userId: req.userId, status: 'Selesai' } },
      { $group: { _id: '$jenis', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Recent activity
    const recentActivity = await WorkLog.find({ userId: req.userId, status: 'Selesai' })
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({
      success: true,
      data: {
        totalBerkas: s.berkas,
        totalBuku: s.buku,
        totalBundle: s.bundle,
        pendingCount,
        weeklyProgress,
        workDistribution,
        recentActivity
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
