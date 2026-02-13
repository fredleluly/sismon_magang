const mongoose = require('mongoose');

const targetSectionSchema = new mongoose.Schema({
  jenis: { type: String, required: true, unique: true, trim: true },
  targetPerDay: { type: Number, default: 0, min: 0 },
}, { timestamps: true });

module.exports = mongoose.model('TargetSection', targetSectionSchema);
