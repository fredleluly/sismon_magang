const router = require('express').Router();
// const mongoose = require('mongoose');
// const User = require('../models/User');
// const Attendance = require('../models/Attendance');
// const WorkLog = require('../models/WorkLog');
// const Complaint = require('../models/Complaint');
const db = require('../db');

// Helper to get random item from array
const random = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Helper to get random int
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// Helper to generate random date in range
const randomDate = (start, end) => {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
};

// GET /api/seed
// Warning: Clears non-admin users and generates new dummy data
router.get('/', async (req, res) => {
  try {
    // 0. Ensure Admin & Super Admin Exist
    const existingAdmin = await db.users.findOne({ email: 'admin@plniconplus.co.id' });
    const existingSuperAdmin = await db.users.findOne({ email: 'superadmin@plniconplus.co.id' });

    if (!existingAdmin) {
      await db.users.insert({
        name: 'Administrator',
        email: 'admin@plniconplus.co.id',
        password: 'admin123',
        role: 'admin',
        instansi: 'PLN ICON+',
        jabatan: 'Administrator',
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    if (!existingSuperAdmin) {
      await db.users.insert({
        name: 'Super Admin',
        email: 'superadmin@plniconplus.co.id',
        password: 'super123',
        role: 'admin',
        instansi: 'PLN ICON+',
        jabatan: 'Super Administrator',
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    // 1. Clear existing non-admin data
    // Find non-admin users first to get their IDs
    // NeDB: $ne operator
    const nonAdminUsers = await db.users.find({ role: { $ne: 'admin' } }); 
    const nonAdminIds = nonAdminUsers.map(u => u._id);

    if (nonAdminIds.length > 0) {
      // Remove data associated with these users
      // NeDB remove with multi: true
      await db.attendance.remove({ userId: { $in: nonAdminIds } }, { multi: true });
      await db.workLogs.remove({ userId: { $in: nonAdminIds } }, { multi: true });
      await db.complaints.remove({ userId: { $in: nonAdminIds } }, { multi: true });
      await db.users.remove({ _id: { $in: nonAdminIds } }, { multi: true });
    }

    // 2. Create Dummy Users
    const instansiList = ['UNJ', 'UI', 'UGM', 'BINUS', 'Telkom University', 'Politeknik Negeri Jakarta'];
    const users = [];

    for (let i = 1; i <= 10; i++) {
        const user = await db.users.insert({
            name: `Peserta Magang ${i}`,
            email: `peserta${i}@gmail.com`,
            password: 'password123', // Plain text as per migration simplicity
            role: 'user',
            instansi: random(instansiList),
            status: 'Aktif',
            jabatan: 'Mahasiswa Magang',
            createdAt: new Date(),
            updatedAt: new Date()
        });
        users.push(user);
    }

    // 3. Generate Data for Last 30 Days
    const today = new Date();
    const startDate = new Date();
    startDate.setDate(today.getDate() - 30);

    let attendanceCount = 0;
    let workLogCount = 0;
    let complaintCount = 0;

    for (const user of users) {
        // Loop through each day from startDate to today
        // Note: new Date(startDate) creates a copy, so startDate itself isn't mutated by loop
        for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
            const currentDay = new Date(d);
            const isWeekend = currentDay.getDay() === 0 || currentDay.getDay() === 6;

            if (isWeekend) continue; // Skip weekends

            // 90% chance of attendance, 10% absence
            if (Math.random() > 0.1) { 
                const status = Math.random() > 0.1 ? 'Hadir' : random(['Telat', 'Sakit', 'Izin']);
                
                const jamMasuk = status === 'Hadir' ? `0${randomInt(7, 8)}:${randomInt(10, 59)}` : (status === 'Telat' ? `09:${randomInt(10, 30)}` : '');
                const jamKeluar = (status === 'Hadir' || status === 'Telat') ? `17:${randomInt(0, 30)}` : '';

                // Attendance Record
                await db.attendance.insert({
                    userId: user._id,
                    tanggal: currentDay,
                    jamMasuk,
                    jamKeluar,
                    status: status,
                    fotoAbsensi: '', // No photo for dummy
                    fotoTimestamp: currentDay.toISOString(),
                    createdAt: currentDay,
                    updatedAt: currentDay
                });
                attendanceCount++;

                // Work Log (Only if Hadir/Telat)
                if (status === 'Hadir' || status === 'Telat') {
                    const activity = random([
                        'Mengembangkan fitur frontend',
                        'Memperbaiki bug backend',
                        'Meeting dengan mentor',
                        'Dokumentasi API',
                        'Testing aplikasi',
                        'Belajar React Native',
                        'Deploy ke server staging'
                    ]);

                     // Specific logic for WorkLog "jenis" if needed, defaulting to random based on original script
                     // Original script: jenis: random(['WFO', 'WFH'])
                    
                    await db.workLogs.insert({
                        userId: user._id,
                        tanggal: currentDay,
                        jenis: random(['WFO', 'WFH']),
                        keterangan: activity,
                        berkas: randomInt(0, 2),
                        buku: randomInt(0, 1),
                        bundle: randomInt(0, 1),
                        status: 'Selesai',
                        createdAt: currentDay,
                        updatedAt: currentDay
                    });
                    workLogCount++;
                }
            } else {
                 // Alpha / Tidak Hadir
                await db.attendance.insert({
                    userId: user._id,
                    tanggal: currentDay,
                    status: 'Alpha',
                    createdAt: currentDay,
                    updatedAt: currentDay
                });
                attendanceCount++;
            }
        }

        // 4. Random Complaints (1-3 per user)
        const numComplaints = randomInt(0, 3);
        const categories = ['Fasilitas', 'Teknis', 'Administrasi', 'Lainnya'];
        
        for (let k = 0; k < numComplaints; k++) {
            await db.complaints.insert({
                userId: user._id,
                judul: `Kendala ${random(['Internet', 'AC', 'Komputer', 'Akses'])}`,
                kategori: random(categories),
                prioritas: random(['Low', 'Medium', 'High']),
                deskripsi: 'Mohon bantuannya untuk kendala ini.',
                status: random(['Menunggu', 'Diproses', 'Selesai']),
                createdAt: new Date(),
                updatedAt: new Date()
            });
            complaintCount++;
        }
    }

    res.json({
        success: true,
        message: 'Database seeded successfully',
        data: {
            usersCreated: users.length,
            attendanceCreated: attendanceCount,
            workLogsCreated: workLogCount,
            complaintsCreated: complaintCount
        }
    });

  } catch (error) {
    console.error('Seed Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
