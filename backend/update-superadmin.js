#!/usr/bin/env node

/**
 * Script untuk update role user ke superadmin
 * Usage: node update-superadmin.js <email>
 * Example: node update-superadmin.js admin@example.com
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

const email = process.argv[2];

if (!email) {
  console.error('❌ Error: Email tidak diberikan');
  console.log('Usage: node update-superadmin.js <email>');
  console.log('Example: node update-superadmin.js admin@example.com');
  process.exit(1);
}

const updateSuperadmin = async () => {
  try {
    console.log('📲 Menghubungkan ke database...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sismon_magang');
    console.log('✅ Database connected');

    console.log(`\n🔍 Mencari user dengan email: ${email}`);
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      console.error(`❌ User dengan email "${email}" tidak ditemukan`);
      await mongoose.connection.close();
      process.exit(1);
    }

    console.log(`\nℹ️  User ditemukan:`);
    console.log(`   Nama: ${user.name}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role sebelumnya: ${user.role}`);

    user.role = 'superadmin';
    await user.save();

    console.log(`\n✅ Role berhasil diupdate menjadi: superadmin`);
    console.log(`\n📝 User sekarang dapat mengakses:`);
    console.log('   • Dashboard');
    console.log('   • Manajemen Penilaian');
    console.log('   • Semua fitur admin lainnya');

    await mongoose.connection.close();
    console.log('\n✅ Script selesai');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

updateSuperadmin();
