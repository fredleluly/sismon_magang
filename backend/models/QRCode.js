const mongoose = require('mongoose');

const qrCodeSchema = new mongoose.Schema({
  tanggal: { type: Date, required: true },
  token: { type: String, required: true, unique: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  scannedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  active: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('QRCode', qrCodeSchema);
