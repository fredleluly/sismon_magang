# 📊 SISMON MAGANG — Sistem Monitoring Magang PLN ICON+

> Panduan konten untuk presentasi PPT — sesuaikan ke dalam template Canva

---

## 📌 Slide: Pendahuluan

### Latar Belakang Masalah

- Proses monitoring dan pengelolaan peserta magang di **PLN ICON+** masih dilakukan secara **manual** menggunakan spreadsheet dan formulir kertas, sehingga rentan terhadap kesalahan data dan tidak efisien.
- **Pencatatan absensi konvensional** (tanda tangan manual) memakan waktu, sulit diverifikasi, dan tidak memberikan data kehadiran secara *real-time*.
- **Penilaian kinerja peserta magang** dilakukan secara subjektif tanpa standar yang terukur, menyulitkan admin dalam membandingkan performa antar peserta.
- **Pelaporan pekerjaan harian** tidak terdokumentasi dengan baik — admin kesulitan memantau progres dan volume pekerjaan setiap peserta magang.
- Tidak ada sistem terpusat untuk mengelola **keluhan/kendala** peserta magang sehingga penanganan sering terlambat.
- Proses pembuatan **rekap data bulanan** (absensi, pekerjaan, penilaian) membutuhkan waktu lama karena harus dikompilasi manual dari berbagai sumber.

### Tujuan Aplikasi

- Membangun sistem **monitoring dan manajemen magang digital** yang terpusat, efisien, dan dapat diakses secara *real-time* oleh admin maupun peserta magang.
- Mendigitalisasi proses **absensi** menggunakan teknologi **QR Code** untuk meningkatkan akurasi, mengurangi kecurangan, dan mempercepat proses pencatatan kehadiran.
- Menyediakan **sistem penilaian kinerja terstruktur** dengan kriteria terukur (Kedisiplinan, Kualitas Kerja, Inisiatif, Kerjasama, Komunikasi) agar evaluasi peserta magang lebih objektif dan transparan.
- Memudahkan peserta magang dalam **melaporkan pekerjaan harian** secara terstruktur dan memudahkan admin dalam **memonitor progres kerja** masing-masing peserta.
- Menyediakan **dashboard analitik** yang menampilkan statistik kehadiran, distribusi pekerjaan, dan performa peserta secara visual melalui grafik interaktif.
- Mengotomasi pembuatan **laporan dan rekap data** dalam format Excel untuk mempercepat proses dokumentasi dan pelaporan.

---

## 📌 Slide: Fitur Utama Aplikasi

### ⊕ Absensi QR Code
Sistem absensi digital berbasis **QR Code** yang di-generate oleh admin. Peserta magang melakukan scan QR Code untuk absen masuk/keluar, dengan pencatatan **waktu otomatis** dan validasi lokasi. Data absensi terekam secara *real-time* dan dapat dilihat melalui **kalender kehadiran** interaktif.

### ⊕ Monitoring Pekerjaan
Fitur untuk peserta magang **mencatat dan melaporkan pekerjaan harian** secara terstruktur (jenis pekerjaan, jumlah berkas/buku/bundle). Admin dapat memantau progres pekerjaan seluruh peserta, dan data ditampilkan dalam bentuk **grafik distribusi kerja** serta **rekapitulasi otomatis**.

### ⊕ Penilaian Performa
Sistem evaluasi kinerja peserta magang berdasarkan **5 kriteria terukur**: Kedisiplinan, Kualitas Kerja, Inisiatif, Kerjasama, dan Komunikasi. Menghasilkan **skor akhir** dan **grade** (A–E) secara otomatis, lengkap dengan **ranking peserta** untuk perbandingan performa.

### ⊕ Dashboard Analitik
Dashboard interaktif dengan **grafik Chart.js** yang menampilkan statistik kehadiran, distribusi pekerjaan, progres mingguan, dan ringkasan performa. Tersedia untuk **Admin** (overview seluruh peserta) dan **User** (data personal peserta).

### ⊕ Laporan & Ekspor Excel
Fitur ekspor data ke format **Excel (.xlsx)** untuk keperluan dokumentasi dan pelaporan resmi. Mencakup rekap absensi, rekap pekerjaan, data penilaian, dan log aktivitas. Menggunakan library **ExcelJS** dengan format tabel profesional.

### ⊕ Kelola Keluhan
Sistem untuk peserta magang menyampaikan **kendala atau keluhan** selama periode magang. Admin dapat melihat, merespon, dan mengelola seluruh keluhan dari satu halaman terpusat.

---

## 📌 Slide: Pengembangan Aplikasi (Tahapan)

### 1. Analisis Kebutuhan Pengguna
Melakukan identifikasi masalah dan kebutuhan monitoring magang di PLN ICON+ melalui observasi alur kerja manual yang ada. Mengidentifikasi dua peran utama (Admin & Peserta Magang) beserta fitur yang dibutuhkan masing-masing. Menyusun *user requirements* mencakup absensi, pencatatan kerja, penilaian, dan pelaporan.

### 2. Desain Aplikasi
Merancang **arsitektur sistem** berbasis Client-Server (Frontend & Backend terpisah). Mendesain **skema database** MongoDB dengan 7 koleksi utama: User, Attendance, WorkLog, PerformanceEvaluation, Complaint, QRCode, dan TargetSection. Merancang **UI/UX** menggunakan pendekatan *responsive design* dengan dua tampilan terpisah untuk Admin dan User.

### 3. Pengembangan & Coding
Membangun aplikasi secara **fullstack** menggunakan **React + TypeScript** untuk frontend dan **Express.js + MongoDB** untuk backend. Mengimplementasikan fitur-fitur utama secara bertahap: autentikasi (JWT), manajemen data peserta, sistem absensi QR Code, pencatatan pekerjaan, penilaian performa, dashboard analitik, dan ekspor laporan Excel.

### 4. Pengujian
Melakukan pengujian fungsional pada setiap modul, pengujian integrasi API frontend-backend, serta pengujian responsivitas tampilan di berbagai perangkat (desktop, tablet, smartphone). Menguji alur end-to-end: dari login → absensi → input pekerjaan → penilaian → ekspor laporan.

### 5. Peluncuran
Aplikasi di-*deploy* untuk digunakan secara internal di lingkungan PLN ICON+ dengan konfigurasi keamanan (HTTPS, JWT authentication). Backend di-deploy dengan dukungan **Vercel** untuk *serverless deployment*, dan frontend disajikan melalui **Vite** build production.

---

## 📌 Slide: Teknologi yang Digunakan

### ⊕ React.js + TypeScript — Framework Frontend
Framework JavaScript modern untuk membangun antarmuka pengguna yang interaktif dan responsif. Digunakan bersama **TypeScript** untuk meningkatkan keamanan tipe data dan kualitas kode. Build menggunakan **Vite** untuk performa development yang cepat.

### ⊕ Express.js + Node.js — Framework Backend
Framework backend berbasis **Node.js** untuk membangun REST API yang menangani seluruh logika bisnis: autentikasi, manajemen data, dan komunikasi dengan database. Dilengkapi middleware **JWT (JSON Web Token)** untuk keamanan autentikasi.

### ⊕ MongoDB + Mongoose — Database NoSQL
Database **NoSQL** berbasis cloud (**MongoDB Atlas**) untuk penyimpanan data aplikasi secara *real-time*. Menggunakan **Mongoose** sebagai ODM (Object Data Modeling) untuk pemodelan data yang terstruktur dan validasi skema.

### ⊕ Chart.js — Visualisasi Data
Library JavaScript untuk menampilkan data dalam bentuk **grafik interaktif** (bar chart, pie chart, line chart) pada dashboard admin dan user. Digunakan untuk visualisasi statistik kehadiran, distribusi pekerjaan, dan progres mingguan.

### ⊕ QR Code (html5-qrcode) — Absensi Digital
Library untuk **generate dan scan QR Code** langsung dari browser. Admin membuat QR Code harian, dan peserta magang melakukan scan melalui kamera perangkat untuk mencatat kehadiran secara otomatis.

### ⊕ ExcelJS — Ekspor Laporan
Library untuk menghasilkan file **Excel (.xlsx)** langsung dari browser dan server. Digunakan untuk membuat laporan rekap absensi, pekerjaan, penilaian, dan log aktivitas dengan format tabel profesional yang siap cetak.

---

## 📌 Slide: Tantangan dalam Pengembangan

### ⊕ Responsivitas Multi-Perangkat
Membuat aplikasi yang **berjalan lancar di berbagai perangkat** — dari desktop monitor besar hingga smartphone layar kecil. Setiap halaman membutuhkan desain responsif dengan CSS media queries di **4 breakpoint** (768px, 600px, 480px, 360px). Tantangan terbesar adalah tabel data yang harus tetap *readable* dan fungsional di layar kecil.

### ⊕ Sistem Absensi QR Code Real-Time
Mengimplementasikan **absensi berbasis QR Code** yang harus bekerja di berbagai perangkat dan browser dengan akses kamera. Tantangan meliputi kompatibilitas kamera, validasi waktu absensi, pencegahan duplikasi absensi, serta penanganan kasus absensi di jaringan yang tidak stabil.

### ⊕ Keamanan Data Pengguna
Menjaga **privasi data** peserta magang dan admin agar tetap aman. Mengimplementasikan autentikasi **JWT** dengan masa berlaku token, enkripsi password menggunakan **bcryptjs**, serta middleware otorisasi yang memastikan setiap endpoint hanya dapat diakses oleh role yang berwenang (admin vs user).

### ⊕ Desain UI/UX yang Intuitif
Membuat desain antarmuka yang **menarik dan mudah digunakan** oleh pengguna dengan variasi tingkat keahlian teknologi. Tantangan meliputi pemisahan tampilan admin dan user, animasi transisi halaman yang smooth menggunakan **GSAP**, dan implementasi toast notification untuk feedback *real-time* kepada pengguna.

---

## 📌 Slide: Keunggulan Aplikasi

### ⊕ Sistem Terintegrasi & Terpusat
Seluruh proses monitoring magang — mulai dari **absensi, pencatatan pekerjaan, penilaian kinerja, hingga pelaporan** — terintegrasi dalam satu platform. Admin tidak perlu lagi menggunakan banyak aplikasi terpisah.

### ⊕ Absensi Digital dengan QR Code
Sistem absensi modern menggunakan **QR Code** yang menghilangkan kebutuhan tanda tangan manual. QR Code di-*generate* setiap hari oleh admin, dan peserta cukup **scan dari smartphone** mereka. Data waktu hadir dan pulang tercatat **otomatis dan akurat**.

### ⊕ Penilaian Performa Terstandarisasi
Evaluasi kinerja peserta magang menggunakan **5 kriteria baku** dengan sistem scoring otomatis yang menghasilkan **grade (A–E)** dan **ranking**. Memastikan penilaian yang **objektif, terukur, dan transparan** bagi seluruh peserta.

### ⊕ Dashboard Real-Time & Visual
Data kehadiran, progres pekerjaan, dan performa peserta ditampilkan melalui **dashboard analitik** dengan grafik interaktif. Admin dapat mengambil keputusan berbasis data secara cepat, dan peserta dapat memantau pencapaiannya secara mandiri.

### ⊕ Ekspor Otomatis ke Excel
Semua data dapat di-**ekspor ke file Excel** dengan satu klik — termasuk rekap absensi, detail pekerjaan, skor penilaian, dan log aktivitas. Format tabel yang rapi dan profesional, siap digunakan untuk **laporan resmi** ke manajemen.

### ⊕ Multi-Role Access (Admin & Peserta)
Aplikasi mendukung **dua role** dengan tampilan dan hak akses berbeda:
- **Admin/Superadmin**: Mengelola peserta, absensi, penilaian, QR Code, dan melihat statistik global.
- **Peserta Magang (User)**: Absensi, input pekerjaan harian, melihat riwayat kerja, dan melaporkan kendala.

### ⊕ Responsive & Mobile-Friendly
Aplikasi dirancang **fully responsive** sehingga dapat diakses dengan nyaman dari **desktop, tablet, maupun smartphone**. Peserta magang dapat melakukan absensi dan input pekerjaan langsung dari HP mereka.

---

## 📌 Daftar Anggota (Sesuaikan)

| No | Nama | Peran |
|:--:|------|-------|
| 1 | *(Nama Anda)* | *(Fullstack Developer / Frontend / dll)* |
| 2 | … | … |
| 3 | … | … |

---

## 📌 Slide: Kesimpulan

Sistem Monitoring Magang (SISMON) **PLN ICON+** berhasil mendigitalisasi proses monitoring peserta magang yang sebelumnya dilakukan secara manual. Dengan fitur **absensi QR Code**, **pencatatan pekerjaan terstruktur**, **penilaian performa terstandarisasi**, dan **ekspor laporan otomatis**, aplikasi ini meningkatkan efisiensi, akurasi, dan transparansi dalam pengelolaan peserta magang. Dibangun dengan teknologi web modern (React, Express.js, MongoDB), SISMON siap digunakan di berbagai perangkat dan dapat dikembangkan lebih lanjut sesuai kebutuhan organisasi.

---

> 💡 **Tips**: Copy-paste teks di atas ke slide PPT Canva Anda sesuai dengan layout template yang sudah ada. Sesuaikan panjang teks jika diperlukan agar pas dengan desain template.
