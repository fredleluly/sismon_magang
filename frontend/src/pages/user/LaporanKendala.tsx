import React, { useState, useEffect, useCallback } from 'react';
import { ComplaintAPI } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import type { Complaint } from '../../types';

const LaporanKendala: React.FC = () => {
  const { showToast } = useToast();
  const [judul, setJudul] = useState('');
  const [kategori, setKategori] = useState('Sortir');
  const [prioritas, setPrioritas] = useState('Medium');
  const [deskripsi, setDeskripsi] = useState('');
  const [logs, setLogs] = useState<Complaint[]>([]);

  const load = useCallback(async () => {
    const res = await ComplaintAPI.getAll();
    if (res && res.success) setLogs(res.data || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await ComplaintAPI.create({ judul, kategori, prioritas: prioritas as any, deskripsi });
    if (res && res.success) {
      showToast('Laporan kendala berhasil dikirim!', 'success');
      setJudul(''); setDeskripsi('');
      load();
    } else showToast(res?.message || 'Gagal mengirim', 'error');
  };

  return (
    <>
      <div className="page-header">
        <h1 style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ width: 48, height: 48, background: 'var(--primary-50)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="var(--primary-500)" strokeWidth="2" width="24" height="24"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><line x1="12" x2="12" y1="9" y2="13" /><line x1="12" x2="12.01" y1="17" y2="17" /></svg></span>
          Laporan Kendala
        </h1>
        <p style={{ marginTop: 4 }}>Laporkan kendala atau masalah yang Anda alami</p>
      </div>
      <div className="kendala-layout">
        <div className="kendala-form-card">
          <div className="form-card-header">
            <div className="form-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /></svg></div>
            <h2>Buat Laporan Baru</h2>
          </div>
          <p className="form-card-subtitle">Isi form di bawah untuk melaporkan kendala</p>
          <form onSubmit={handleSubmit}>
            <div className="form-group"><label>Judul Kendala *</label><input type="text" value={judul} onChange={e => setJudul(e.target.value)} placeholder="Contoh: Sistem error saat input data" required style={{ width: '100%', padding: '14px 16px', background: 'var(--gray-50)', border: '2px solid var(--gray-200)', borderRadius: 'var(--radius-md)', fontSize: 14 }} /></div>
            <div className="form-row">
              <div className="form-group"><label>Kategori</label><select value={kategori} onChange={e => setKategori(e.target.value)}>
                <option>Sortir</option><option>Register</option><option>Pencopotan Steples</option><option>Scanning</option><option>Rekardus</option><option>Stikering</option><option>Sistem</option><option>Lainnya</option>
              </select></div>
              <div className="form-group"><label>Prioritas</label><select value={prioritas} onChange={e => setPrioritas(e.target.value)}>
                <option value="Low">Low</option><option value="Medium">Medium</option><option value="High">High</option>
              </select></div>
            </div>
            <div className="form-group"><label>Deskripsi Kendala *</label><textarea value={deskripsi} onChange={e => setDeskripsi(e.target.value)} placeholder="Jelaskan kendala yang Anda alami secara detail..." rows={4} required /></div>
            <button type="submit" className="btn btn-primary btn-full">Kirim Laporan</button>
          </form>
        </div>
        <div className="riwayat-card">
          <h3>Riwayat Laporan</h3>
          <p className="riwayat-sub">Total {logs.length} laporan</p>
          {logs.length === 0 ? <div className="riwayat-empty"><div className="empty-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" /></svg></div><p>Belum ada laporan</p></div> :
            <div className="riwayat-list">{logs.map((log, i) => {
              const date = new Date(log.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
              const prioClass = log.prioritas === 'High' ? 'high' : log.prioritas === 'Medium' ? 'medium' : 'low';
              const statusBadge = log.status === 'Selesai' ? <span style={{ color: '#059669', fontSize: 11, fontWeight: 600 }}>✓ Selesai</span> : log.status === 'Diproses' ? <span style={{ color: '#0066cc', fontSize: 11, fontWeight: 600 }}>⟳ Diproses</span> : <span style={{ color: '#d97706', fontSize: 11, fontWeight: 600 }}>⏳ Menunggu</span>;
              return <div key={log._id} className="riwayat-item" style={{ animation: `fadeInUp 0.3s ease ${i * 0.08}s both` }}>
                <div className="ri-header"><span className="ri-title">{log.judul}</span><span className="ri-date">{date}</span></div>
                <div className="ri-desc">{log.deskripsi.substring(0, 80)}{log.deskripsi.length > 80 ? '...' : ''}</div>
                <div className="ri-footer"><span className={`priority-badge ${prioClass}`}>{log.prioritas}</span><span className="category-badge">{log.kategori}</span>{statusBadge}</div>
              </div>;
            })}</div>}
        </div>
      </div>
    </>
  );
};

export default LaporanKendala;
