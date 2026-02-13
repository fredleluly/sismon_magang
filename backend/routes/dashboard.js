const router = require('express').Router();
// Mongoose models -> replaced by NeDB
const db = require('../db');
const { auth, adminOnly } = require('../middleware/auth');

// GET /api/dashboard/admin — admin dashboard stats
router.get('/admin', auth, adminOnly, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const totalPeserta = await db.users.count({ role: 'user' });

    // Total completed work & stats
    // Fetch all completed work logs
    const completedLogs = await db.workLogs.find({ status: 'Selesai' });
    
    // Calculate total items
    const ws = completedLogs.reduce((acc, log) => ({
        total: acc.total + 1,
        berkas: acc.berkas + (log.berkas || 0),
        buku: acc.buku + (log.buku || 0),
        bundle: acc.bundle + (log.bundle || 0)
    }), { total: 0, berkas: 0, buku: 0, bundle: 0 });

    // Today's attendance
    const todayAttendance = await db.attendance.count({
      tanggal: { $gte: new Date(today), $lt: new Date(today + 'T23:59:59') }
    });

    // Attendance rate
    const attendanceRate = totalPeserta > 0 ? Math.round((todayAttendance / totalPeserta) * 100) : 0;

    // Average productivity (items per person)
    const avgProductivity = totalPeserta > 0 ? Math.round((ws.berkas + ws.buku + ws.bundle) / totalPeserta) : 0;

    // Top 5 performers
    // Group by userId -> sum items -> sort -> limit -> populate
    const performerMap = {};
    for (const log of completedLogs) {
        if (!performerMap[log.userId]) {
            performerMap[log.userId] = 0;
        }
        performerMap[log.userId] += ((log.berkas || 0) + (log.buku || 0) + (log.bundle || 0));
    }
    
    // Convert map to array, sort, take top 5
    let topPerformersList = Object.keys(performerMap).map(userId => ({
        userId,
        totalItems: performerMap[userId]
    })).sort((a, b) => b.totalItems - a.totalItems).slice(0, 5);

    // Populate user names
    const topPerformers = await Promise.all(topPerformersList.map(async (p) => {
        const user = await db.users.findOne({ _id: p.userId });
        return { name: user ? user.name : 'Unknown', totalItems: p.totalItems };
    }));

    const { startDate, endDate } = req.query;
    // Filter logic manual
    let filteredLogs = completedLogs;
    if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate + 'T23:59:59');
        filteredLogs = completedLogs.filter(log => {
             const logDate = new Date(log.tanggal);
             return logDate >= start && logDate <= end;
        });
    }

    // Specific totals by jenis (Filtered)
    const getStat = (jenis) => {
        const matching = filteredLogs.filter(l => l.jenis === jenis);
        return matching.reduce((sum, l) => sum + (l.berkas || 0) + (l.buku || 0) + (l.bundle || 0), 0);
    };

    const totalSortir = getStat('Sortir');
    const totalSteples = getStat('Pencopotan Steples');
    const totalScanning = getStat('Scanning');
    const totalRegister = getStat('Register');
    const totalStikering = getStat('Stikering');
    const totalRekardus = getStat('Rekardus');

    // Register specific breakdown
    const registerLogs = filteredLogs.filter(l => l.jenis === 'Register');
    const registerStats = registerLogs.reduce((acc, log) => ({
        berkas: acc.berkas + (log.berkas || 0),
        buku: acc.buku + (log.buku || 0),
        bundle: acc.bundle + (log.bundle || 0)
    }), { berkas: 0, buku: 0, bundle: 0 });


    // Chart Data (Filtered)
    // If startDate/endDate present, use filteredLogs. Else check default range (2 weeks).
    let chartLogs = [];
    if (startDate && endDate) {
        // filter already applied to filteredLogs BUT we need to filter specifically for 'Rekardus' AND 'Selesai' (completedLogs/filteredLogs already Selesai)
        chartLogs = filteredLogs.filter(l => l.jenis === 'Rekardus');
    } else {
       const twoWeeksAgo = new Date();
       twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
       chartLogs = completedLogs.filter(l => l.jenis === 'Rekardus' && new Date(l.tanggal) >= twoWeeksAgo);
    }

    // Group chart data by date
    const chartMap = {};
    for (const log of chartLogs) {
        const dateStr = new Date(log.tanggal).toISOString().split('T')[0];
        if (!chartMap[dateStr]) {
            chartMap[dateStr] = { _id: dateStr, berkas: 0, buku: 0, bundle: 0, total: 0 };
        }
        chartMap[dateStr].berkas += (log.berkas || 0);
        chartMap[dateStr].buku += (log.buku || 0);
        chartMap[dateStr].bundle += (log.bundle || 0);
        chartMap[dateStr].total += ((log.berkas || 0) + (log.buku || 0) + (log.bundle || 0));
    }
    const chartData = Object.values(chartMap).sort((a, b) => a._id.localeCompare(b._id));

    // Work distribution by jenis (Filtered)
    const distMap = {};
    for (const log of filteredLogs) {
        if (!distMap[log.jenis]) distMap[log.jenis] = 0;
        distMap[log.jenis]++;
    }
    const workDistribution = Object.keys(distMap).map(jenis => ({ _id: jenis, count: distMap[jenis] })).sort((a, b) => b.count - a.count);

    // Recent activity
    let recentActivity = await db.workLogs.find({ status: 'Selesai' }).sort({ createdAt: -1 }).limit(5);
    recentActivity = await Promise.all(recentActivity.map(async (l) => {
        const user = await db.users.findOne({ _id: l.userId });
        return { 
            ...l, 
            userId: user ? { _id: user._id, name: user.name } : null 
        };
    }));

    res.json({
      success: true,
      data: {
        totalPeserta,
        totalPekerjaanSelesai: ws.total, 
        totalBerkas: ws.berkas, 
        totalBuku: ws.buku,
        totalBundle: ws.bundle,
        
        totalSortir,
        totalSteples,
        totalScanning,
        totalRegister,
        totalStikering,
        totalRekardus,
        registerStats,

        todayAttendance,
        attendanceRate,
        avgProductivity,
        topPerformers,
        weeklyProgress: chartData, 
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
    // User stats
    const userLogs = await db.workLogs.find({ userId: req.userId, status: 'Selesai' });
    const s = userLogs.reduce((acc, log) => ({
        berkas: acc.berkas + (log.berkas || 0),
        buku: acc.buku + (log.buku || 0),
        bundle: acc.bundle + (log.bundle || 0)
    }), { berkas: 0, buku: 0, bundle: 0 });

    // Pending count
    const pendingCount = await db.workLogs.count({ userId: req.userId, status: 'Draft' });

    // Weekly progress
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const weekLogs = userLogs.filter(log => new Date(log.tanggal) >= oneWeekAgo);
    
    // Group by date
    const dateMap = {};
    for (const log of weekLogs) {
         const dateStr = new Date(log.tanggal).toISOString().split('T')[0];
         if (!dateMap[dateStr]) dateMap[dateStr] = { _id: dateStr, berkas: 0, buku: 0, bundle: 0 };
         dateMap[dateStr].berkas += (log.berkas || 0);
         dateMap[dateStr].buku += (log.buku || 0);
         dateMap[dateStr].bundle += (log.bundle || 0);
    }
    const weeklyProgress = Object.values(dateMap).sort((a, b) => a._id.localeCompare(b._id));

    // Work distribution
    const distMap = {};
    for (const log of userLogs) {
        if (!distMap[log.jenis]) distMap[log.jenis] = 0;
        distMap[log.jenis]++;
    }
    const workDistribution = Object.keys(distMap).map(jenis => ({ _id: jenis, count: distMap[jenis] })).sort((a, b) => b.count - a.count);

    // Recent activity
    const recentActivity = await db.workLogs.find({ userId: req.userId, status: 'Selesai' })
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
