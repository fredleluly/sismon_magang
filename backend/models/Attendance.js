const mongoose = require('mongoose');


const attendanceSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tanggal: { type: Date, required: true },
  jamMasuk: { type: String, default: '' },
  jamKeluar: { type: String, default: '' },
  status: { type: String, enum: ['Hadir', 'Izin', 'Sakit', 'Alpha', 'Telat', 'Tidak Hadir', 'Hari Libur', 'Belum Absen'], default: 'Hadir' },
  qrCodeId: { type: mongoose.Schema.Types.ObjectId, ref: 'QRCode' },
  fotoAbsensi: { type: String, default: '' }, // base64 encoded photo (masuk)
  fotoUrl: { type: String, default: '' }, // URL to uploaded photo file (masuk)
  fotoTimestamp: { type: String, default: '' }, // timestamp from user's device timezone
  fotoPulang: { type: String, default: '' }, // base64 encoded photo (pulang)
  fotoPulangUrl: { type: String, default: '' }, // URL to uploaded photo file (pulang)
  fotoPulangTimestamp: { type: String, default: '' }, // timestamp pulang
  // Geolocation
  locationMasuk: {
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    address: { type: String, default: '' },
    accuracy: { type: Number, default: null },
  },
  locationPulang: {
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    address: { type: String, default: '' },
    address: { type: String, default: '' },
    accuracy: { type: Number, default: null },
  },
  keterangan: { type: String, default: '' },
}, { timestamps: true });

// One attendance per user per day
attendanceSchema.index({ userId: 1, tanggal: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
