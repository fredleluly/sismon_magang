# Update User Role ke Superadmin

Ada 3 cara untuk mengupdate role user menjadi `superadmin`:

---

## **Cara 1: Menggunakan Script Node.js (Rekomendasi ✅)**

### Langkah-langkah:

1. **Buka terminal di folder backend**

   ```bash
   cd backend
   ```

2. **Jalankan script update-superadmin.js dengan email user**

   ```bash
   node update-superadmin.js admin@example.com
   ```

3. **Output yang akan Anda lihat:**

   ```
   📲 Menghubungkan ke database...
   ✅ Database connected

   🔍 Mencari user dengan email: admin@example.com

   ℹ️  User ditemukan:
      Nama: Admin User
      Email: admin@example.com
      Role sebelumnya: admin

   ✅ Role berhasil diupdate menjadi: superadmin

   📝 User sekarang dapat mengakses:
      • Dashboard
      • Manajemen Penilaian
      • Semua fitur admin lainnya

   ✅ Script selesai
   ```

4. **Logout dan login ulang** di aplikasi untuk melihat menu "Manajemen Penilaian"

---

## **Cara 2: Menggunakan MongoDB Client Langsung**

Jika Anda memiliki akses MongoDB langsung:

### MongoDB Command:

```javascript
// Di MongoDB Shell atau compass
db.users.updateOne(
  { email: "admin@example.com" },
  { $set: { role: "superadmin" } },
);
```

### Contoh MongoDB Compass:

1. Buka MongoDB Compass
2. Connect ke database `sismon_magang`
3. Buka collection `users`
4. Temukan user dengan email yang ingin di-update
5. Edit field `role` dari `"admin"` menjadi `"superadmin"`
6. Simpan

---

## **Cara 3: Menggunakan API Endpoint (jika sudah ada superadmin lain)**

Jika sudah ada user dengan role `superadmin`, bisa gunakan API:

```bash
PATCH /api/users/:userId/role
```

### Request:

```bash
curl -X PATCH http://localhost:5173/api/users/USER_ID/role \
  -H "Authorization: Bearer TOKEN_SUPERADMIN" \
  -H "Content-Type: application/json" \
  -d '{"role": "superadmin"}'
```

---

## **Cara 4: Menggunakan Seeding Script (untuk setup baru)**

Jika ingin menambah superadmin saat seeding, edit `seed.js`:

```javascript
// File: backend/seed.js
const users = [
  {
    name: "Super Admin",
    email: "superadmin@pln.com",
    password: "Password123",
    role: "superadmin", // <-- Add this
    instansi: "PLN",
  },
  // ... users lainnya
];
```

Kemudian jalankan:

```bash
node seed.js
```

---

## **Verifikasi Perubahan**

1. **Cara 1 & 2 & 4:** Logout dan login ulang di aplikasi
2. **Cara 3:** Refresh page, menu "Manajemen Penilaian" seharusnya muncul

### Di Browser Console:

```javascript
// Akan menampilkan:
// User role: superadmin
```

---

## **Troubleshooting**

**Masalah:** Menu "Manajemen Penilaian" masih tidak muncul setelah update

- [ ] Pastikan sudah logout dan login ulang
- [ ] Clear browser cache (Ctrl+Shift+Del atau Cmd+Shift+Delete)
- [ ] Hard refresh page (Ctrl+F5 atau Cmd+Shift+R)
- [ ] Cek di browser console apakah `User role: superadmin` muncul

**Masalah:** Script error "MONGODB_URI tidak ditemukan"

- [ ] Pastikan file `.env` sudah ada dan berisi `MONGODB_URI`
- [ ] Pastikan MongoDB service running

**Masalah:** User tidak ditemukan

- [ ] Pastikan email user benar (case sensitive bisa tergantung DB)
- [ ] Contoh: `node update-superadmin.js superadmin@example.com`

---

## **Ringkasan Perubahan Backend:**

✅ **User.js** - Added `'superadmin'` to role enum
✅ **update-superadmin.js** - Script untuk update role user
✅ **routes/users.js** - API endpoint `PATCH /api/users/:id/role`

Frontend sudah support superadmin role, tinggal backend role yang perlu di-update! 🚀
