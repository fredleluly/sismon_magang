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

    // Weekly work progress (last 2 weeks by day)
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const weeklyProgress = await WorkLog.aggregate([
      { $match: { status: 'Selesai', tanggal: { $gte: twoWeeksAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$tanggal' } },
          berkas: { $sum: '$berkas' }, buku: { $sum: '$buku' }, bundle: { $sum: '$bundle' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Work distribution by jenis
    const workDistribution = await WorkLog.aggregate([
      { $match: { status: 'Selesai' } },
      { $group: { _id: '$jenis', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Recent activity
    const recentActivity = await WorkLog.find({ status: 'Selesai' })
      .populate('userId', 'name')
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      success: true,
      data: {
        totalPeserta,
        totalPekerjaanSelesai: ws.total,
        totalBerkas: ws.berkas,
        totalBuku: ws.buku,
        totalBundle: ws.bundle,
        todayAttendance,
        attendanceRate,
        avgProductivity,
        topPerformers,
        weeklyProgress,
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
