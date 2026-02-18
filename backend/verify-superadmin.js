const mongoose = require('mongoose');
require('dotenv').config();

// User model
const userSchema = new mongoose.Schema({
  name: String,
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },
  password: String,
  role: {
    type: String,
    enum: ['user', 'admin', 'superadmin'],
    default: 'user',
  },
  institution: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const User = mongoose.model('User', userSchema);

async function verifySuperadmin() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/sismon_magang';
    await mongoose.connect(mongoUri);
    console.log('✓ Terhubung ke database');

    // Cari semua user dengan role admin atau superadmin
    const users = await User.find({ $or: [{ role: 'admin' }, { role: 'superadmin' }] });

    if (users.length === 0) {
      console.log('\n❌ Tidak ada user dengan role admin atau superadmin');
    } else {
      console.log('\n📋 Daftar User Admin/Superadmin:\n');
      users.forEach((user, index) => {
        console.log(`${index + 1}. ${user.name}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Role: ${user.role} ${user.role === 'superadmin' ? '✓' : ''}`);
        console.log('');
      });
    }

    // Specifically check for superadmin@plniconplus.co.id
    const superadminUser = await User.findOne({ email: 'superadmin@plniconplus.co.id' });
    if (superadminUser) {
      console.log('✓ User superadmin@plniconplus.co.id ditemukan');
      console.log(`  Role: ${superadminUser.role}`);
    } else {
      console.log('❌ User superadmin@plniconplus.co.id TIDAK ditemukan');
    }

    await mongoose.connection.close();
    console.log('\n✓ Database connection closed');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

verifySuperadmin();
