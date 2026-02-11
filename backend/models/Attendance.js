const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tanggal: { type: Date, required: true },
  jamMasuk: { type: String, default: '' },
  jamKeluar: { type: String, default: '' },
  status: { type: String, enum: ['Hadir', 'Izin', 'Sakit', 'Alpha', 'Telat'], default: 'Hadir' },
  qrCodeId: { type: mongoose.Schema.Types.ObjectId, ref: 'QRCode' },
  fotoAbsensi: { type: String, default: '' }, // base64 encoded photo
  fotoTimestamp: { type: String, default: '' }, // timestamp from user's device timezone
}, { timestamps: true });

// One attendance per user per day
attendanceSchema.index({ userId: 1, tanggal: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
