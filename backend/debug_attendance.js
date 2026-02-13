const mongoose = require('mongoose');
require('dotenv').config();

// Define/Load User model first
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
}, { timestamps: true });
mongoose.model('User', userSchema);

// Define/Load QRCode model first to avoid potential reference errors
const qrSchema = new mongoose.Schema({
  token: { type: String, required: true },
  tanggal: { type: Date, required: true },
  active: { type: Boolean, default: true },
}, { timestamps: true });
mongoose.model('QRCode', qrSchema);

const Attendance = require('./models/Attendance');

console.log('Connecting to:', process.env.MONGODB_URI);

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB');
    
    // Find the latest attendance with a jamKeluar
    const latest = await Attendance.findOne({ jamKeluar: { $ne: '' } })
        .sort({ updatedAt: -1 })
        .populate('userId', 'name');
        
    if (latest) {
      console.log('RECORD_FOUND_START');
      console.log('ID:', latest._id);
      console.log('KETERANGAN:', latest.keterangan);
      console.log('RECORD_FOUND_END');
    } else {
      console.log('No checkout records found.');
    }
    mongoose.disconnect();
  })
  .catch(err => {
    console.error('Error connecting or querying:', err);
    process.exit(1);
  });
