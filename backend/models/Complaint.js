const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  judul: { type: String, required: true },
  kategori: { type: String, required: true },
  prioritas: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
  deskripsi: { type: String, required: true },
  status: { type: String, enum: ['Menunggu', 'Diproses', 'Selesai'], default: 'Menunggu' },
}, { timestamps: true });

module.exports = mongoose.model('Complaint', complaintSchema);
