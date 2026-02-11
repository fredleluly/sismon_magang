import React, { useState, useEffect, useCallback } from 'react';
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
    if (!confirm(`Kirim final semua ${pendingData.length} data draft?`)) return;
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
  };

  const deletePending = async (id: string) => {
    if (!confirm('Hapus data pending ini?')) return;
    const res = await WorkLogAPI.delete(id);
    if (res && res.success) {
      showToast('Data pending berhasil dihapus', 'success');
      loadPending();
    } else showToast(res?.message || 'Gagal menghapus', 'error');
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
              <option value="Register">Register</option>
              <option value="Pencopotan Steples">Pencopotan Steples</option>
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
    </div>
  );
};

export default InputPekerjaan;
