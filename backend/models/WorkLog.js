const mongoose = require('mongoose');

const workLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tanggal: { type: Date, required: true },
  jenis: { type: String, required: true },
  keterangan: { type: String, default: '' },
  berkas: { type: Number, default: 0 },
  buku: { type: Number, default: 0 },
  bundle: { type: Number, default: 0 },
  status: { type: String, enum: ['Draft', 'Selesai'], default: 'Draft' },
}, { timestamps: true });

module.exports = mongoose.model('WorkLog', workLogSchema);
