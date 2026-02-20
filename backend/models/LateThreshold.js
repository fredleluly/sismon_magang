const mongoose = require('mongoose');

const lateThresholdSchema = new mongoose.Schema(
  {
    tanggal: { type: String, required: true, unique: true }, // format: YYYY-MM-DD
    threshold: { type: String, required: true, default: '08:00' }, // format: HH:MM
    alasan: { type: String, default: '' }, // alasan perubahan (e.g. "Hujan deras", "Banjir", dll)
  },
  { timestamps: true },
);

module.exports = mongoose.model('LateThreshold', lateThresholdSchema);
