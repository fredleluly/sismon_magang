import React, { useState, useEffect, useCallback } from 'react';
import { ComplaintAPI } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import type { Complaint } from '../../types';
import CustomSelect from '../../components/CustomSelect';

const LaporanKendala: React.FC = () => {
  const { showToast } = useToast();
  const [judul, setJudul] = useState('');
  const [kategori, setKategori] = useState('Sortir');
  const [prioritas, setPrioritas] = useState('Medium');
  const [deskripsi, setDeskripsi] = useState('');
  const [logs, setLogs] = useState<Complaint[]>([]);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editJudul, setEditJudul] = useState('');
  const [editKategori, setEditKategori] = useState('');
  const [editPrioritas, setEditPrioritas] = useState('');
  const [editDeskripsi, setEditDeskripsi] = useState('');

  // Delete confirmation state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await ComplaintAPI.getAll();
    if (res && res.success) setLogs(res.data || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await ComplaintAPI.create({ judul, kategori, prioritas: prioritas as any, deskripsi });
    if (res && res.success) {
      showToast('Laporan kendala berhasil dikirim!', 'success');
      setJudul('');
      setDeskripsi('');
      load();
    } else showToast(res?.message || 'Gagal mengirim', 'error');
  };

  const startEdit = (log: Complaint) => {
    setEditingId(log._id);
    setEditJudul(log.judul);
    setEditKategori(log.kategori);
    setEditPrioritas(log.prioritas);
    setEditDeskripsi(log.deskripsi);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditJudul('');
    setEditKategori('');
    setEditPrioritas('');
    setEditDeskripsi('');
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    const res = await ComplaintAPI.update(editingId, {
      judul: editJudul,
      kategori: editKategori,
      prioritas: editPrioritas as any,
      deskripsi: editDeskripsi,
    });
    if (res && res.success) {
      showToast('Laporan berhasil diperbarui!', 'success');
      cancelEdit();
      load();
    } else {
      showToast(res?.message || 'Gagal memperbarui laporan', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    const res = await ComplaintAPI.delete(id);
    if (res && res.success) {
      showToast('Laporan berhasil dihapus!', 'success');
      setDeletingId(null);
      load();
    } else {
      showToast(res?.message || 'Gagal menghapus laporan', 'error');
    }
  };

  return (
    <>
      <div className="page-header">
        <h1 style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ width: 48, height: 48, background: 'var(--primary-50)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="var(--primary-500)" strokeWidth="2" width="24" height="24">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <line x1="12" x2="12" y1="9" y2="13" />
              <line x1="12" x2="12.01" y1="17" y2="17" />
            </svg>
          </span>
          Laporan Kendala
        </h1>
        <p style={{ marginTop: 4 }}>Laporkan kendala atau masalah yang Anda alami</p>
      </div>
      <div className="kendala-layout">
        <div className="kendala-form-card">
          <div className="form-card-header">
            <div className="form-icon">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <h2>Buat Laporan Baru</h2>
          </div>
          <p className="form-card-subtitle">Isi form di bawah untuk melaporkan kendala</p>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Judul Kendala *</label>
              <input
                type="text"
                value={judul}
                onChange={(e) => setJudul(e.target.value.toUpperCase())}
                placeholder="Contoh: Sistem error saat input data"
                required
                style={{ width: '100%', padding: '14px 16px', background: 'var(--gray-50)', border: '2px solid var(--gray-200)', borderRadius: 'var(--radius-md)', fontSize: 14 }}
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Kategori</label>
                <CustomSelect
                  value={kategori}
                  onChange={setKategori}
                  options={[
                    { value: 'Sortir', label: 'Sortir' },
                    { value: 'Register', label: 'Registrasi' },
                    { value: 'Pencopotan Steples', label: 'Pencopotan Staples' },
                    { value: 'Scanning', label: 'Scanning' },
                    { value: 'Rekardus', label: 'Rekardus' },
                    { value: 'Stikering', label: 'Stikering' },
                    { value: 'Sistem', label: 'Sistem' },
                    { value: 'Lainnya', label: 'Lainnya' },
                  ]}
                />
              </div>
              <div className="form-group">
                <label>Prioritas</label>
                <CustomSelect
                  value={prioritas}
                  onChange={setPrioritas}
                  options={[
                    { value: 'Low', label: 'Low' },
                    { value: 'Medium', label: 'Medium' },
                    { value: 'High', label: 'High' },
                  ]}
                />
              </div>
            </div>
            <div className="form-group">
              <label>Deskripsi Kendala *</label>
              <textarea value={deskripsi} onChange={(e) => setDeskripsi(e.target.value)} placeholder="Jelaskan kendala yang Anda alami secara detail..." rows={4} required />
            </div>
            <button type="submit" className="btn btn-primary btn-full">
              Kirim Laporan
            </button>
          </form>
        </div>
        <div className="riwayat-card">
          <h3>Riwayat Laporan</h3>
          <p className="riwayat-sub">Total {logs.length} laporan</p>
          {logs.length === 0 ? (
            <div className="riwayat-empty">
              <div className="empty-icon">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" x2="12" y1="8" y2="12" />
                  <line x1="12" x2="12.01" y1="16" y2="16" />
                </svg>
              </div>
              <p>Belum ada laporan</p>
            </div>
          ) : (
            <div className="riwayat-list">
              {logs.map((log, i) => {
                const date = new Date(log.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
                const prioClass = log.prioritas === 'High' ? 'high' : log.prioritas === 'Medium' ? 'medium' : 'low';
                const canModify = log.status === 'Menunggu';
                const statusBadge =
                  log.status === 'Selesai' ? (
                    <span style={{ color: '#059669', fontSize: 11, fontWeight: 600 }}>✓ Selesai</span>
                  ) : log.status === 'Diproses' ? (
                    <span style={{ color: '#0066cc', fontSize: 11, fontWeight: 600 }}>⟳ Diproses</span>
                  ) : (
                    <span style={{ color: '#d97706', fontSize: 11, fontWeight: 600 }}>⏳ Menunggu</span>
                  );
                return (
                  <div key={log._id} className="riwayat-item" style={{ animation: `fadeInUp 0.3s ease ${i * 0.08}s both` }}>
                    <div className="ri-header">
                      <span className="ri-title">{log.judul}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="ri-date">{date}</span>
                        {canModify && (
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button
                              onClick={() => startEdit(log)}
                              title="Edit laporan"
                              style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: 4,
                                borderRadius: 6,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'background 0.2s',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = '#e0f2fe')}
                              onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                                <path d="m15 5 4 4" />
                              </svg>
                            </button>
                            <button
                              onClick={() => setDeletingId(log._id)}
                              title="Hapus laporan"
                              style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: 4,
                                borderRadius: 6,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'background 0.2s',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = '#fef2f2')}
                              onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 6h18" />
                                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                                <line x1="10" x2="10" y1="11" y2="17" />
                                <line x1="14" x2="14" y1="11" y2="17" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="ri-desc">
                      {log.deskripsi.substring(0, 80)}
                      {log.deskripsi.length > 80 ? '...' : ''}
                    </div>
                    <div className="ri-footer">
                      <span className={`priority-badge ${prioClass}`}>{log.prioritas}</span>
                      <span className="category-badge">{log.kategori}</span>
                      {statusBadge}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editingId && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            backdropFilter: 'blur(4px)',
          }}
          onClick={cancelEdit}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 16,
              padding: '24px 28px',
              width: '100%',
              maxWidth: 480,
              boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
              animation: 'fadeInUp 0.25s ease',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1a1a2e' }}>Edit Laporan</h3>
              <button onClick={cancelEdit} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#94a3b8' }}>
                ✕
              </button>
            </div>
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6, display: 'block' }}>Judul Kendala</label>
              <input
                type="text"
                value={editJudul}
                onChange={(e) => setEditJudul(e.target.value.toUpperCase())}
                style={{ width: '100%', padding: '12px 14px', background: '#f8fafc', border: '2px solid #e2e8f0', borderRadius: 10, fontSize: 14, boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div className="form-group">
                <label style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6, display: 'block' }}>Kategori</label>
                <CustomSelect
                  value={editKategori}
                  onChange={setEditKategori}
                  options={[
                    { value: 'Sortir', label: 'Sortir' },
                    { value: 'Register', label: 'Registrasi' },
                    { value: 'Pencopotan Steples', label: 'Pencopotan Staples' },
                    { value: 'Scanning', label: 'Scanning' },
                    { value: 'Rekardus', label: 'Rekardus' },
                    { value: 'Stikering', label: 'Stikering' },
                    { value: 'Sistem', label: 'Sistem' },
                    { value: 'Lainnya', label: 'Lainnya' },
                  ]}
                />
              </div>
              <div className="form-group">
                <label style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6, display: 'block' }}>Prioritas</label>
                <CustomSelect
                  value={editPrioritas}
                  onChange={setEditPrioritas}
                  options={[
                    { value: 'Low', label: 'Low' },
                    { value: 'Medium', label: 'Medium' },
                    { value: 'High', label: 'High' },
                  ]}
                />
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6, display: 'block' }}>Deskripsi</label>
              <textarea
                value={editDeskripsi}
                onChange={(e) => setEditDeskripsi(e.target.value)}
                rows={3}
                style={{ width: '100%', padding: '12px 14px', background: '#f8fafc', border: '2px solid #e2e8f0', borderRadius: 10, fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={cancelEdit}
                style={{
                  padding: '10px 20px',
                  background: '#f1f5f9',
                  color: '#475569',
                  border: 'none',
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Batal
              </button>
              <button
                onClick={handleUpdate}
                style={{
                  padding: '10px 20px',
                  background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => setDeletingId(null)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 16,
              padding: '24px 28px',
              width: '100%',
              maxWidth: 380,
              boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
              textAlign: 'center',
              animation: 'fadeInUp 0.25s ease',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: '#fef2f2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18" />
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              </svg>
            </div>
            <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: '#1a1a2e' }}>Hapus Laporan?</h3>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: '#64748b' }}>Laporan yang dihapus tidak dapat dikembalikan.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                onClick={() => setDeletingId(null)}
                style={{
                  padding: '10px 24px',
                  background: '#f1f5f9',
                  color: '#475569',
                  border: 'none',
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Batal
              </button>
              <button
                onClick={() => handleDelete(deletingId)}
                style={{
                  padding: '10px 24px',
                  background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default LaporanKendala;
