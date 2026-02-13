// ============================================
// Seed Script — Create Admin Accounts Only
// Run: node seed.js
// ============================================

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB');

  const existingAdmin = await User.findOne({ email: 'admin@plniconplus.co.id' });
  const existingSuperAdmin = await User.findOne({ email: 'superadmin@plniconplus.co.id' });

  if (existingAdmin && existingSuperAdmin) {
    console.log('⚠️  Admin accounts already exist. Skipping seed.');
    process.exit(0);
  }

  if (!existingAdmin) {
    await User.create({
      name: 'Administrator',
      email: 'admin@plniconplus.co.id',
      password: 'admin123',
      role: 'admin',
      instansi: 'PLN ICON+',
      jabatan: 'Administrator',
    });
    console.log('👤 Admin account created');
  }

  if (!existingSuperAdmin) {
    await User.create({
      name: 'Super Admin',
      email: 'superadmin@plniconplus.co.id',
      password: 'super123',
      role: 'admin',
      instansi: 'PLN ICON+',
      jabatan: 'Super Administrator',
    });
    console.log('👤 Super Admin account created');
  }

  console.log('\n🎉 Seed complete!');
  console.log('========================================');
  console.log('AKUN LOGIN ADMIN:');
  console.log('Admin       : admin@plniconplus.co.id / admin123');
  console.log('Super Admin : superadmin@plniconplus.co.id / super123');
  console.log('========================================');
  console.log('Peserta mendaftar via halaman Registrasi atau ditambahkan admin.');

  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seed error:', err);
  process.exit(1);
});
