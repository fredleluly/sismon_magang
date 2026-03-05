const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const WorkLog = require('../models/WorkLog');
const Complaint = require('../models/Complaint');

// Helper to get random item from array
const random = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Helper to get random int
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// GET /api/seed
// Warning: Clears non-admin users and generates new dummy data
router.get('/', async (req, res) => {
  try {
    // 0. Ensure Admin & Super Admin Exist
    const existingAdmin = await User.findOne({ email: 'admin@plniconplus.co.id' });
    const existingSuperAdmin = await User.findOne({ email: 'superadmin@plniconplus.co.id' });

    if (!existingAdmin) {
      await User.create({
        name: 'Administrator',
        email: 'admin@plniconplus.co.id',
        password: 'admin123',
        role: 'admin',
        instansi: 'PLN ICON+',
        jabatan: 'Administrator',
      });
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
    }

    // 1. Only add new dummy users (DO NOT delete existing data)
    // Skip users whose email already exists

    // 2. Create Dummy Users with realistic Indonesian names
    const instansiList = ['UNJ', 'UI', 'UGM', 'BINUS', 'Telkom University', 'Politeknik Negeri Jakarta'];
    const dummyNames = [
      'Rizky Ramadhan',
      'Anisa Putri',
      'Fajar Nugroho',
      'Lina Marlina',
      'Hendra Wijaya',
      'Novi Anggraini',
      'Bagas Saputra',
      'Mega Puspita',
      'Arif Hidayat',
      'Yuni Kartika',
    ];
    const users = [];

    for (let i = 0; i < dummyNames.length; i++) {
      const email = `pesertab${i + 1}@gmail.com`;
      const existing = await User.findOne({ email });
      if (existing) continue; // Skip if already exists

      const user = new User({
        name: dummyNames[i],
        email,
        password: 'password123',
        role: 'user',
        instansi: random(instansiList),
        status: 'Aktif',
        jabatan: 'Mahasiswa Magang',
      });
      await user.save();
      users.push(user);
    }

    // 3. Generate Data for Last 30 Days
    const today = new Date();
    const startDate = new Date();
    startDate.setDate(today.getDate() - 30);

    // Real section names matching JENIS_LIST
    const sectionList = ['Sortir', 'Register', 'Pencopotan Steples', 'Scanning', 'Rekardus', 'Stikering'];
    const keteranganList = [
      'Mengerjakan arsip bagian A',
      'Memproses dokumen batch baru',
      'Melanjutkan pekerjaan kemarin',
      'Menyelesaikan target harian',
      'Mengerjakan dokumen prioritas',
      'Memproses berkas arsip lama',
      'Mengerjakan bundle arsip tambahan',
    ];

    let attendanceCount = 0;
    let workLogCount = 0;
    let complaintCount = 0;

    for (const user of users) {
      for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
        const currentDay = new Date(d);
        const isWeekend = currentDay.getDay() === 0 || currentDay.getDay() === 6;

        if (isWeekend) {
          const attendance = new Attendance({
            userId: user._id,
            tanggal: currentDay,
            status: 'Hari Libur',
          });
          await attendance.save();
          attendanceCount++;
          continue;
        }

        // 90% chance of attendance
        if (Math.random() > 0.1) {
          const statusRoll = Math.random();
          let status;
          if (statusRoll > 0.15) status = 'Hadir';
          else if (statusRoll > 0.08) status = 'Telat';
          else if (statusRoll > 0.04) status = 'Sakit';
          else status = 'Izin';

          const attendance = new Attendance({
            userId: user._id,
            tanggal: currentDay,
            jamMasuk: status === 'Hadir' ? `0${randomInt(7, 8)}:${String(randomInt(0, 59)).padStart(2, '0')}` : (status === 'Telat' ? `09:${String(randomInt(5, 45)).padStart(2, '0')}` : ''),
            jamKeluar: (status === 'Hadir' || status === 'Telat') ? `17:${String(randomInt(0, 30)).padStart(2, '0')}` : '',
            status: status,
            fotoAbsensi: '',
            fotoTimestamp: currentDay.toISOString(),
          });
          await attendance.save();
          attendanceCount++;

          // Work Logs — multiple sections per day (2 to 4 entries)
          if (status === 'Hadir' || status === 'Telat') {
            const numEntries = randomInt(2, 4);
            const usedSections = new Set();
            for (let w = 0; w < numEntries; w++) {
              let section;
              do {
                section = random(sectionList);
              } while (usedSections.has(section) && usedSections.size < sectionList.length);
              usedSections.add(section);

              const workLog = new WorkLog({
                userId: user._id,
                tanggal: currentDay,
                jenis: section,
                keterangan: random(keteranganList),
                berkas: randomInt(5, 30),
                buku: randomInt(0, 10),
                bundle: randomInt(0, 5),
                status: 'Selesai',
              });
              await workLog.save();
              workLogCount++;
            }
          }
        } else {
          // Alpha
          const attendance = new Attendance({
            userId: user._id,
            tanggal: currentDay,
            status: 'Alpha',
          });
          await attendance.save();
          attendanceCount++;
        }
      }

      // 4. Random Complaints (1-3 per user)
      const numComplaints = randomInt(1, 3);
      const categories = ['Fasilitas', 'Teknis', 'Administrasi', 'Lainnya'];

      for (let k = 0; k < numComplaints; k++) {
        const complaint = new Complaint({
          userId: user._id,
          judul: `Kendala ${random(['Internet Lambat', 'AC Mati', 'Komputer Error', 'Akses VPN', 'Printer Rusak'])}`,
          kategori: random(categories),
          prioritas: random(['Low', 'Medium', 'High']),
          deskripsi: 'Mohon bantuannya untuk menyelesaikan kendala ini agar pekerjaan tidak terhambat.',
          status: random(['Menunggu', 'Diproses', 'Selesai']),
        });
        await complaint.save();
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
        complaintsCreated: complaintCount,
      },
    });

  } catch (error) {
    console.error('Seed Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
