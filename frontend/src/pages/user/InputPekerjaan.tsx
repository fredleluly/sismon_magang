import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { WorkLogAPI } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import type { WorkLog } from '../../types';
import './InputPekerjaan.css';

const InputPekerjaan: React.FC = () => {
  const { showToast } = useToast();
  const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [jenis, setJenis] = useState('');
  const [keterangan, setKeterangan] = useState('');
  const [berkas, setBerkas] = useState(0);
  const [buku, setBuku] = useState(0);
  const [bundle, setBundle] = useState(0);
  const [pendingData, setPendingData] = useState<WorkLog[]>([]);

  const loadPending = useCallback(async () => {
    const res = await WorkLogAPI.getAll('status=Draft');
    if (res && res.success) setPendingData(res.data || []);
  }, []);

  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    confirmText: string;
    type: 'danger' | 'primary';
    onConfirm: () => void;
  }>({ show: false, title: '', message: '', confirmText: '', type: 'primary', onConfirm: () => {} });

  const showConfirm = (title: string, message: string, confirmText: string, type: 'danger' | 'primary', onConfirm: () => void) => {
    setConfirmModal({ show: true, title, message, confirmText, type, onConfirm });
  };

  const closeConfirm = () => setConfirmModal((prev) => ({ ...prev, show: false }));

  // Add pause/blur effect on modal open
  useEffect(() => {
    const app = document.querySelector('.app-wrapper');
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        closeConfirm();
      }
    };

    if (confirmModal.show) {
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
  }, [confirmModal.show]);

  useEffect(() => {
    loadPending();
  }, [loadPending]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = { tanggal, jenis, keterangan, berkas, buku, bundle, status: 'Draft' as const };
    const res = await WorkLogAPI.create(data);
    if (res && res.success) {
      showToast('Data berhasil disimpan sebagai draft!', 'success');
      setJenis('');
      setKeterangan('');
      setBerkas(0);
      setBuku(0);
      setBundle(0);
      setTanggal(new Date().toISOString().split('T')[0]);
      loadPending();
    } else {
      showToast(res?.message || 'Gagal menyimpan', 'error');
    }
  };

  const submitPending = async (id: string) => {
    const res = await WorkLogAPI.submit(id);
    if (res && res.success) {
      showToast('Data berhasil dikirim final!', 'success');
      loadPending();
    } else showToast(res?.message || 'Gagal mengirim', 'error');
  };

  const submitAllPending = async () => {
    if (pendingData.length === 0) return;

    showConfirm('Kirim Semua Log?', `Apakah Anda yakin ingin mengirim semua ${pendingData.length} log pekerjaan status draft menjadi final? Data yang sudah final tidak dapat diubah lagi.`, 'Ya, Kirim Semua', 'primary', async () => {
      closeConfirm();
      let success = 0;
      let fail = 0;
      for (const item of pendingData) {
        const res = await WorkLogAPI.submit(item._id);
        if (res && res.success) success++;
        else fail++;
      }
      if (fail === 0) {
        showToast(`${success} data berhasil dikirim final!`, 'success');
      } else {
        showToast(`${success} berhasil, ${fail} gagal dikirim`, 'error');
      }
      loadPending();
    });
  };

  const deletePending = async (id: string) => {
    showConfirm('Hapus Log?', 'Apakah Anda yakin ingin menghapus log pekerjaan ini? Tindakan ini tidak dapat dibatalkan.', 'Ya, Hapus', 'danger', async () => {
      closeConfirm();
      const res = await WorkLogAPI.delete(id);
      if (res && res.success) {
        showToast('Data pending berhasil dihapus', 'success');
        loadPending();
      } else showToast(res?.message || 'Gagal menghapus', 'error');
    });
  };

  const editPending = async (id: string) => {
    const item = pendingData.find((i) => i._id === id);
    if (!item) return;
    setTanggal(new Date(item.tanggal).toISOString().split('T')[0]);
    setJenis(item.jenis);
    setKeterangan(item.keterangan || '');
    setBerkas(item.berkas);
    setBuku(item.buku);
    setBundle(item.bundle);
    await WorkLogAPI.delete(id);
    loadPending();
    showToast('Data dimuat untuk diedit', 'info');
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="input-pekerjaan-layout">
      <div className="form-card">
        <div className="form-card-header">
          <div className="form-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </div>
          <h2>Formulir Log Harian</h2>
        </div>
        <p className="form-card-subtitle">Isi detail pekerjaan Anda hari ini.</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Tanggal</label>
            <input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Jenis Pekerjaan (Jobdesk)</label>
            <select value={jenis} onChange={(e) => setJenis(e.target.value)} required>
              <option value="">Pilih Pekerjaan (Jobdesk)</option>
              <option value="Sortir">Sortir</option>
              <option value="Register">Registrasi</option>
              <option value="Pencopotan Steples">Pencopotan Staples</option>
              <option value="Scanning">Scanning</option>
              <option value="Rekardus">Rekardus</option>
              <option value="Stikering">Stikering</option>
            </select>
          </div>
          <div className="form-group">
            <label>Keterangan Berkas</label>
            <textarea value={keterangan} onChange={(e) => setKeterangan(e.target.value)} placeholder="Masukkan keterangan berkas..." rows={3} />
          </div>
          <div className="form-row-3">
            <div className="form-group">
              <label>Jumlah Berkas</label>
              <input type="number" min="0" value={berkas} onChange={(e) => setBerkas(+e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Jumlah Buku</label>
              <input type="number" min="0" value={buku} onChange={(e) => setBuku(+e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Jumlah Bundle</label>
              <input type="number" min="0" value={bundle} onChange={(e) => setBundle(+e.target.value)} required />
            </div>
          </div>
          <button type="submit" className="btn btn-primary btn-full" style={{ marginTop: 8 }}>
            Simpan sebagai Draft
          </button>
        </form>
      </div>
      <div className="pending-list-card">
        <div className="pending-header">
          <h3>Data Pending</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="pending-count">{pendingData.length}</span>
            {pendingData.length > 1 && (
              <button className="btn-send" onClick={submitAllPending} style={{ fontSize: '12px', padding: '4px 12px' }}>
                Kirim Semua
              </button>
            )}
          </div>
        </div>
        <p className="pending-subtitle">Data yang belum dikirim final.</p>
        <div>
          {pendingData.length === 0 ? (
            <div className="pending-empty">
              <p>Belum ada data pending</p>
            </div>
          ) : (
            pendingData.map((item) => (
              <div key={item._id} className="pending-item">
                <div className="pending-item-header">
                  <div>
                    <div className="pending-item-title">{item.jenis}</div>
                    <div className="pending-item-date">{formatDate(item.tanggal)}</div>
                  </div>
                  <button className="pending-item-delete" onClick={() => deletePending(item._id)} title="Hapus">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
                {item.keterangan && (
                  <div className="pending-item-keterangan" style={{ fontSize: 13, color: '#64748b', marginBottom: 8, padding: '6px 10px', background: '#f8fafc', borderRadius: 6, borderLeft: '3px solid #0ea5e9' }}>
                    <span className="label" style={{ display: 'block', marginBottom: 2 }}>
                      Keterangan:
                    </span>
                    <span>{item.keterangan}</span>
                  </div>
                )}
                <div className="pending-item-body">
                  <div>
                    <span className="label">Berkas:</span>
                    <span>{item.berkas}</span>
                  </div>
                  <div>
                    <span className="label">Buku:</span>
                    <span>{item.buku}</span>
                  </div>
                  <div>
                    <span className="label">Bundle:</span>
                    <span>{item.bundle}</span>
                  </div>
                </div>
                <div className="pending-item-footer">
                  <button className="btn-send" onClick={() => submitPending(item._id)}>
                    Kirim Final
                  </button>
                  <button className="btn-edit" onClick={() => editPending(item._id)}>
                    Edit
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Confirm Modal (Portal) */}
      {confirmModal.show &&
        ReactDOM.createPortal(
          <div className="modal-overlay active" style={{ zIndex: 9999 }}>
            <div className="modal-card" style={{ maxWidth: '400px', textAlign: 'center' }}>
              <div className="modal-body" style={{ padding: '32px 24px 24px' }}>
                <div
                  className={`confirm-icon-wrap ${confirmModal.type}`}
                  style={{
                    margin: '0 auto 16px',
                    width: 64,
                    height: 64,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: confirmModal.type === 'danger' ? '#fee2e2' : '#e0f2fe',
                    color: confirmModal.type === 'danger' ? '#ef4444' : '#0ea5e9',
                  }}
                >
                  {confirmModal.type === 'danger' ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                      <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                  )}
                </div>

                <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: '#1e293b' }}>{confirmModal.title}</h3>
                <p style={{ fontSize: 14, color: '#64748b', marginBottom: 24, lineHeight: 1.5 }}>{confirmModal.message}</p>

                <div style={{ display: 'flex', gap: 12 }}>
                  <button className="btn-outline" onClick={closeConfirm} style={{ flex: 1, justifyContent: 'center' }}>
                    Batal
                  </button>
                  <button className={`btn ${confirmModal.type === 'danger' ? 'btn-danger' : 'btn-primary'}`} onClick={confirmModal.onConfirm} style={{ flex: 1, justifyContent: 'center' }}>
                    {confirmModal.confirmText}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};

export default InputPekerjaan;
