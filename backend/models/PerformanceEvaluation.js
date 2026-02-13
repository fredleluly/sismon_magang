const mongoose = require('mongoose');

const performanceEvaluationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  bulan: { type: Number, required: true, min: 1, max: 12 },
  tahun: { type: Number, required: true },
  absen: { type: Number, default: 0, min: 0, max: 35 },
  kuantitas: { type: Number, default: 0, min: 0, max: 30 },
  kualitas: { type: Number, default: 0, min: 0, max: 30 },
  laporan: { type: Boolean, default: false },
  hasil: { type: Number, default: 0, min: 0, max: 100 },
  status: { type: String, enum: ['Draft', 'Final'], default: 'Draft' },
}, { timestamps: true });

// One evaluation per user per month
performanceEvaluationSchema.index({ userId: 1, bulan: 1, tahun: 1 }, { unique: true });

module.exports = mongoose.model('PerformanceEvaluation', performanceEvaluationSchema);
