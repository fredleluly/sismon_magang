const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, required: true }, // e.g., 'DELETE_EVALUATION', 'RESET_EVALUATION', 'UPDATE_SUPERADMIN'
  targetId: { type: mongoose.Schema.Types.ObjectId }, // ID of the object being acted upon
  targetType: { type: String }, // e.g., 'PerformanceEvaluation'
  details: { type: String }, // Human-readable details
}, { timestamps: true });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
