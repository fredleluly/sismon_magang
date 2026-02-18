# Backend Requirements untuk Fitur Manajemen Penilaian (Superadmin)

## Overview
Fitur ini memungkinkan Superadmin untuk menghapus/reset penilaian yang sudah difinalisasi jika terjadi kesalahan input dari Admin.

---

## API Endpoints Required

### 1. DELETE /api/performance/:id
**Purpose:** Hapus/reset penilaian (ubah status dari Final menjadi Draft atau hapus record)

**Request:**
```
DELETE /api/performance/:id
Headers:
  - Authorization: Bearer <token>
  - Content-Type: application/json
```

**Response Success (200):**
```json
{
  "success": true,
  "message": "Penilaian berhasil dihapus",
  "data": {
    "_id": "...",
    "userId": "...",
    "status": "Draft"
  }
}
```

**Response Error (400/500):**
```json
{
  "success": false,
  "message": "Error message"
}
```

**Business Logic:**
- Hanya Admin dengan role 'superadmin' yang bisa akses endpoint ini
- Ketika delete, penilaian harusnya direset ke status 'Draft' agar Admin bisa membuat penilaian baru
- Atau bisa langsung dihapus dari database (tergang desain backend)
- Log activity untuk audit trail

---

## Frontend Implementation Done ✅

### Files Created:
1. **ManajemenPenilaian.tsx** - Halaman untuk Superadmin manage penilaian
   - List penilaian dengan status "Final" 
   - Filter by bulan/tahun
   - Delete button dengan confirmation modal
   - Display: nama peserta, institusi, nilai, grade, action

2. **ManajemenPenilaian.css** - Styling untuk halaman
   - Responsive design (mobile, tablet, desktop)
   - Modal confirmation styling
   - Table styling

3. **App.tsx** - Updated routing
   - Route: `/admin/manajemen-penilaian`

4. **AdminSidebar.tsx** - Updated sidebar menu
   - Added "Manajemen Penilaian" menu item

5. **api.ts** - Already has delete method
   - PerformanceAPI.delete(id) sudah tersedia

---

## Frontend API Call
```typescript
// Code di ManajemenPenilaian.tsx
const handleConfirmDelete = async () => {
  const res = await PerformanceAPI.delete(evalId);
  if (res && res.success) {
    showToast('Penilaian berhasil dihapus', 'success');
    // Update UI
  }
};
```

---

## Backend Implementation Checklist

- [ ] Add DELETE endpoint: `/api/performance/:id`
- [ ] Add authorization check (role === 'superadmin')
- [ ] Reset penilaian status ke 'Draft' atau delete record
- [ ] Add audit log entry
- [ ] Add error handling and validation
- [ ] Test endpoint dengan Postman/Thunder Client

---

## Role Management
**Note:** Current user roles: 'admin' | 'user'

Untuk full implementation, mungkin perlu:
- Add 'superadmin' role ke database
- Update User model/schema dengan role 'superadmin'
- Ensure Admin yang access /admin/manajemen-penilaian hanya superadmin

---

## Testing Checklist
- [ ] Superadmin bisa akses halaman Manajemen Penilaian
- [ ] List penilaian Final muncul dengan benar
- [ ] Filter bulan/tahun berfungsi
- [ ] Delete button menampilkan confirmation modal
- [ ] Setelah delete, data di-refresh dan toast success muncul
- [ ] Error handling jika delete gagal

---

## Future Enhancements
- [ ] Bulk delete multiple evaluations
- [ ] Download report penilaian yang sudah dihapus
- [ ] Audit trail/history untuk semua perubahan penilaian
- [ ] Approve penilaian sebelum finalize
