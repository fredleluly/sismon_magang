import React, { useEffect, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { UsersAPI } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import type { User } from '../../types';
import CustomDatePicker from '../../components/CustomDatePicker';
import CustomSelect from '../../components/CustomSelect';

const DataPeserta: React.FC = () => {
  const { showToast } = useToast();
  const { user } = useAuth();
  const [peserta, setPeserta] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'aktif' | 'nonaktif'>('aktif');
  const [modal, setModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', email: '', username: '', password: '', status: 'Aktif', role: 'user', nonaktifDate: '', tanggalMasuk: '' });

  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; id: string | null }>({ show: false, id: null });
  const [resetPassword, setResetPassword] = useState<{ show: boolean; id: string | null; name: string }>({ show: false, id: null, name: '' });
  const [newPassword, setNewPassword] = useState('');

  const load = useCallback(async () => {
    const res = await UsersAPI.getAll();
    if (res && res.success) setPeserta(res.data || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const app = document.querySelector('.app-wrapper');
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };

    if (modal) {
      document.body.style.overflow = 'hidden';
      if (app) app.classList.add('paused');
      window.addEventListener('keydown', escHandler, true);
    } else {
      document.body.style.overflow = 'unset';
      if (app) app.classList.remove('paused');
    }

    return () => {
      document.body.style.overflow = 'unset';
      if (app) app.classList.remove('paused');
      window.removeEventListener('keydown', escHandler, true);
    };
  }, [modal]);

  const filtered = peserta
    .filter((p) => {
      const pStatus = p.status || 'Aktif';
      return (activeTab === 'aktif' && pStatus === 'Aktif') || (activeTab === 'nonaktif' && pStatus === 'Nonaktif');
    })
    .filter((p) => (p.name || '').toLowerCase().includes(search.toLowerCase()) || (p.username || '').toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  const openAdd = () => {
    setEditingId(null);
    setForm({ name: '', email: '', username: '', password: '', status: 'Aktif', role: 'user', nonaktifDate: '', tanggalMasuk: new Date().toISOString().split('T')[0] });
    setModal(true);
  };
  const openEdit = (id: string) => {
    const p = peserta.find((x) => x._id === id);
    if (!p) return;
    setEditingId(id);
    const tm = p.tanggalMasuk ? p.tanggalMasuk.split('T')[0] : p.createdAt ? p.createdAt.split('T')[0] : new Date().toISOString().split('T')[0];
    setForm({ name: p.name, email: p.email, username: p.username || '', password: '', status: p.status || 'Aktif', role: p.role || 'user', nonaktifDate: p.nonaktifDate ? p.nonaktifDate.split('T')[0] : '', tanggalMasuk: tm });
    setModal(true);
  };

  const openResetPassword = (id: string, name: string) => {
    setNewPassword('');
    setResetPassword({ show: true, id, name });
  };

  const handleResetPassword = async () => {
    if (!resetPassword.id || !newPassword) {
      showToast('Password baru wajib diisi!', 'error');
      return;
    }
    if (newPassword.length < 6) {
      showToast('Password minimal 6 karakter!', 'error');
      return;
    }

    const res = await UsersAPI.resetPassword(resetPassword.id, newPassword);
    if (res && res.success) {
      showToast('Password berhasil direset', 'success');
      setResetPassword({ show: false, id: null, name: '' });
    } else {
      showToast(res?.message || 'Gagal mereset password', 'error');
    }
  };

  const save = async () => {
    if (!form.name || !form.email) {
      showToast('Nama dan email wajib diisi!', 'error');
      return;
    }
    let res;
    const payload = {
      name: form.name,
      email: form.email,
      username: form.username.trim() || undefined,
      status: form.status,
      nonaktifDate: form.status === 'Nonaktif' ? form.nonaktifDate || undefined : undefined,
      tanggalMasuk: form.tanggalMasuk || undefined,
    };

    if (editingId) {
      res = await UsersAPI.update(editingId, payload);
    } else {
      res = await UsersAPI.create({ ...payload, password: form.password || 'magang123' } as any);
    }
    if (res && res.success) {
      showToast(res.message || 'Berhasil', 'success');
      setModal(false);
      load();
    } else showToast(res?.message || 'Gagal', 'error');
  };

  const del = async (id: string) => {
    // show custom confirmation modal instead of browser confirm
    setDeleteConfirm({ show: true, id });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm.id) return;
    const res = await UsersAPI.delete(deleteConfirm.id);
    if (res && res.success) {
      showToast('Berhasil dihapus', 'success');
      load();
    } else showToast(res?.message || 'Gagal', 'error');
    setDeleteConfirm({ show: false, id: null });
  };

  const avColors = ['av-a', 'av-b', 'av-c', 'av-d', 'av-e'];

  const calculateDuration = (dateStr?: string, entryDateStr?: string) => {
    const activeDateStr = entryDateStr || dateStr;
    if (!activeDateStr) return '0 hari';
    const start = new Date(activeDateStr);
    const now = new Date();
    let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
    let dayStart = new Date(start.getFullYear(), start.getMonth() + months, start.getDate());
    if (dayStart > now) {
      months--;
      dayStart = new Date(start.getFullYear(), start.getMonth() + months, start.getDate());
    }
    const days = Math.floor((now.getTime() - dayStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (months <= 0) return `${days} hari`;
    return days > 0 ? `${months} bulan ${days} hari` : `${months} bulan`;
  };

  return (
    <>
      <div className="page-header-row">
        <div className="page-header">
          <h1>Data Peserta Magang</h1>
          <p>Kelola dan pantau data peserta magang PLN ICON+</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          Tambah Peserta
        </button>
      </div>

      <div className="rekap-tabs" style={{ marginBottom: '16px' }}>
        <button className={`rekap-tab-btn ${activeTab === 'aktif' ? 'active' : ''}`} onClick={() => setActiveTab('aktif')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          Peserta Aktif
        </button>
        <button className={`rekap-tab-btn ${activeTab === 'nonaktif' ? 'active' : ''}`} onClick={() => setActiveTab('nonaktif')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <line x1="18" y1="8" x2="23" y2="13" />
            <line x1="23" y1="8" x2="18" y2="13" />
          </svg>
          Peserta Nonaktif
        </button>
      </div>

      <div style={{ marginBottom: '20px', display: 'flex' }}>
        <span className="rekap-info-badge">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
          </svg>
          {peserta.filter((p) => (p.status || 'Aktif') === (activeTab === 'aktif' ? 'Aktif' : 'Nonaktif')).length} Peserta
        </span>
      </div>

      <div className="peserta-table-card">
        <div className="peserta-table-header">
          <div className="pth-left">
            <h3>Daftar Peserta Magang</h3>
          </div>
          <div className="peserta-search">
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama atau username..." />
          </div>
        </div>
        <div className="peserta-table-wrapper">
          <table className="peserta-table">
            <thead>
              <tr>
                <th>Nama</th>
                <th>Username</th>
                <th>Berkas</th>
                <th>Buku</th>
                <th>Bundle</th>
                <th>Lama Magang</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => {
                const initials = (p.name || '')
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .substring(0, 2)
                  .toUpperCase();
                return (
                  <tr key={p._id}>
                    <td>
                      <div className="user-cell">
                        <div className={`user-avatar ${avColors[i % 5]}`}>{initials}</div>
                        <div>
                          <div className="user-name truncate-text" title={p.name}>{p.name}</div>
                          <div className="user-email truncate-text" title={p.email}>{p.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="data-highlight username truncate-text" title={p.username || '-'}>{p.username || '-'}</span>
                    </td>
                    <td>
                      <span className="data-highlight">{(p.totalBerkas || 0).toLocaleString()}</span>
                    </td>
                    <td>
                      <span className="data-highlight">{p.totalBuku || 0}</span>
                    </td>
                    <td>
                      <span className="data-highlight">{p.totalBundle || 0}</span>
                    </td>
                    <td>
                      <span className="data-highlight" style={{ color: '#0369a1', fontWeight: '700' }}>
                        {calculateDuration(p.createdAt, p.tanggalMasuk)}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                        <span className={`status-badge ${(p.status || 'Aktif').toLowerCase()}`}>{p.status || 'Aktif'}</span>
                        {p.status === 'Aktif' && (
                          <span style={{ fontSize: '11px', color: '#059669', fontWeight: 600 }}>
                            sejak {p.tanggalMasuk || p.createdAt ? new Date(p.tanggalMasuk || p.createdAt || '').toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '-'}
                          </span>
                        )}
                        {p.status === 'Nonaktif' && p.nonaktifDate && (
                          <span style={{ fontSize: '11px', color: '#ef4444', fontWeight: 600 }}>dari {new Date(p.nonaktifDate).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: '2-digit' })}</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="action-btns">
                        <button className="action-btn edit" onClick={() => openEdit(p._id)} title="Edit Peserta">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                            <path d="m15 5 4 4" />
                          </svg>
                        </button>
                        <button className="action-btn warning" onClick={() => openResetPassword(p._id, p.name)} title="Reset Password" style={{ background: '#f59e0b', color: 'white' }}>
                          🔑
                        </button>
                        <button className="action-btn delete" onClick={() => del(p._id)} title="Hapus Peserta">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6h18" />
                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                            <line x1="10" x2="10" y1="11" y2="17" />
                            <line x1="14" x2="14" y1="11" y2="17" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {deleteConfirm.show &&
            ReactDOM.createPortal(
              <div className="modal-overlay active">
                <div className="modal-card modal-delete-confirm">
                  <div className="modal-header">
                    <h3>Konfirmasi Penghapusan</h3>
                    <div className="modal-close" onClick={() => setDeleteConfirm({ show: false, id: null })}>
                      ✕
                    </div>
                  </div>
                  <div className="modal-body">
                    <p style={{ textAlign: 'center', color: '#666', marginBottom: '20px' }}>Apakah Anda yakin ingin menghapus peserta ini? Tindakan ini tidak dapat dibatalkan.</p>
                  </div>
                  <div className="modal-footer">
                    <button className="btn-outline" onClick={() => setDeleteConfirm({ show: false, id: null })}>
                      Batal
                    </button>
                    <button className="btn btn-danger" onClick={confirmDelete}>
                      Hapus Peserta
                    </button>
                  </div>
                </div>
              </div>,
              document.body,
            )}
          {resetPassword.show &&
            ReactDOM.createPortal(
              <div className="modal-overlay active">
                <div className="modal-card">
                  <div className="modal-header">
                    <h3>Reset Password</h3>
                    <div className="modal-close" onClick={() => setResetPassword({ show: false, id: null, name: '' })}>
                      ✕
                    </div>
                  </div>
                  <div className="modal-body">
                    <p style={{ marginBottom: '15px' }}>
                      Masukkan password baru untuk pengguna <strong>{resetPassword.name}</strong>.
                    </p>
                    <div className="form-group">
                      <label>Password Baru</label>
                      <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Minimal 6 karakter" autoFocus />
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button className="btn-outline" onClick={() => setResetPassword({ show: false, id: null, name: '' })}>
                      Batal
                    </button>
                    <button className="btn btn-primary" onClick={handleResetPassword}>
                      Simpan Password Baru
                    </button>
                  </div>
                </div>
              </div>,
              document.body,
            )}
        </div>
      </div>
      {modal &&
        ReactDOM.createPortal(
          <div className="modal-overlay active">
            <div className="modal-card">
              <div className="modal-header">
                <h3>{editingId ? 'Edit Data Peserta' : 'Tambah Peserta'}</h3>
                <div className="modal-close" onClick={() => setModal(false)}>
                  ✕
                </div>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label>Nama Lengkap</label>
                  <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nama lengkap" />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" />
                </div>
                <div className="form-group">
                  <label>Username</label>
                  <input type="text" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="Username untuk login" />
                </div>

                <div className="form-group">
                  <label>Status Peserta</label>
                  <CustomSelect
                    value={form.status}
                    onChange={(val) => setForm({ ...form, status: val })}
                    options={[
                      { value: 'Aktif', label: 'Aktif' },
                      { value: 'Nonaktif', label: 'Nonaktif' },
                    ]}
                  />
                </div>
                <div className="form-group">
                  <label>Tanggal Masuk</label>
                  <CustomDatePicker 
                    value={form.tanggalMasuk}
                    onChange={(val) => setForm({ ...form, tanggalMasuk: val })}
                  />
                </div>
                {form.status === 'Nonaktif' && (
                  <div className="form-group">
                    <label>Tanggal Nonaktif</label>
                    <CustomDatePicker 
                      value={form.nonaktifDate}
                      onChange={(val) => setForm({ ...form, nonaktifDate: val })}
                    />
                    <small style={{ color: '#666', marginTop: 4, display: 'block' }}>Mulai tanggal ini dan seterusnya, data absen belum absen akan dihilangkan.</small>
                  </div>
                )}
                {!editingId && user?.role === 'superadmin' && (
                  <div className="form-group">
                    <label>Role</label>
                    <CustomSelect
                      value={form.role}
                      onChange={(val) => setForm({ ...form, role: val })}
                      options={[
                        { value: 'user', label: 'User (Peserta Magang)' },
                        { value: 'admin', label: 'Admin' },
                      ]}
                    />
                  </div>
                )}
                {!editingId && (
                  <div className="form-group">
                    <label>Password</label>
                    <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Default: magang123" />
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button className="btn-outline" onClick={() => setModal(false)}>
                  Batal
                </button>
                <button className="btn btn-primary" onClick={save}>
                  Simpan
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
};

export default DataPeserta;
