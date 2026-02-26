const getWorkingDays = async (bulan, tahun) => {
  const startDate = new Date(tahun, bulan - 2, 26);
  const endDate = new Date(tahun, bulan - 1, 25, 23, 59, 59, 999);
  
  const mongoose = require('mongoose');
  await mongoose.connect('mongodb://127.0.0.1:27017/sismon_magang');
  // Need to load User model since it's referenced
  require('./models/User');
  const Attendance = require('./models/Attendance');
  const PerformanceEvaluation = require('./models/PerformanceEvaluation');
  
  const holidays = await Attendance.find({
    tanggal: { $gte: startDate, $lte: endDate },
    status: 'Hari Libur'
  }).distinct('tanggal');
  
  const holidayDates = new Set(holidays.map(d => new Date(d).toDateString()));
  console.log('Holidays DB for period:', holidayDates);
  
  const workingDays = [];
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const day = d.getDay();
    if (day !== 0 && day !== 6 && !holidayDates.has(d.toDateString())) {
      workingDays.push(new Date(d));
    }
  }
  
  const evals = await PerformanceEvaluation.find({ bulan: 2, tahun: 2026 });
  console.log('Evals for Feb 2026:', evals.map(e => e.hasil));
  
  await mongoose.disconnect();
  return workingDays;
};

getWorkingDays(2, 2026).then(days => {
  console.log('Working days length:', days.length);
}).catch(console.error);
