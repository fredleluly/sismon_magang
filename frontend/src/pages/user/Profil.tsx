import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { AuthAPI, WorkLogAPI } from '../../services/api';
import type { WorkStats } from '../../types';

const Profil: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [instansi, setInstansi] = useState('');
  const [username, setUsername] = useState('');
  const [stats, setStats] = useState<WorkStats>({berkas:0,buku:0,bundle:0});

  useEffect(() => {
    if (user) {
      setEmail(user.email); setInstansi(user.instansi || '');
      setUsername(user.name.toLowerCase().replace(/\s/g, ''));
    }
    WorkLogAPI.getMyStats().then(res => { if (res && res.success) setStats(res.data); });
  }, [user]);

  const handleSave = async () => {
    const data: any = { email, instansi };
    const raw = username.replace(/[_.-]/g,' ').replace(/\s+/g,' ').trim();
    data.name = raw.split(' ').map((w: string)=>w.charAt(0).toUpperCase()+w.slice(1)).join(' ');
    const res = await AuthAPI.updateProfile(data);
    if (res && res.success) { showToast('Profil berhasil diperbarui!', 'success'); refreshUser(); }
    else showToast(res?.message || 'Gagal update', 'error');
  };

  if (!user) return null;
  const initials = user.name.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase();

  return (
    <div className="profile-layout">
      <div>
        <div className="profile-card">
          <div className="profile-cover"></div>
          <div className="profile-avatar-area">
            <div className="profile-avatar">{initials}</div>
            <div className="profile-name">{user.name}</div>
            <div className="profile-role">Peserta Magang</div>
            <div className="profile-badges"><span className="badge-aktif">Aktif</span><span className="badge-pln">PLN ICON+</span></div>
          </div>
          <div className="profile-stats">
            <div className="ps-item"><span className="ps-label">Total Berkas</span><span className="ps-value">{stats.berkas.toLocaleString()}</span></div>
            <div className="ps-item"><span className="ps-label">Total Buku</span><span className="ps-value">{stats.buku.toLocaleString()}</span></div>
            <div className="ps-item"><span className="ps-label">Total Bundle</span><span className="ps-value">{stats.bundle.toLocaleString()}</span></div>
          </div>
        </div>
      </div>
      <div>
        <div className="profile-info-card">
          <h3>Informasi Pribadi</h3><p className="info-sub">Perbarui detail pribadi Anda di sini.</p>
          <div className="profile-form">
            <div className="form-group"><label>Username</label><div className="input-wrapper"><span className="input-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></span><input type="text" className="profile-input" value={username} onChange={e=>setUsername(e.target.value)} /></div></div>
            <div className="form-group"><label>Email</label><div className="input-wrapper"><span className="input-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg></span><input type="email" className="profile-input" value={email} onChange={e=>setEmail(e.target.value)} /></div></div>
            <div className="form-group"><label>Instansi / Universitas</label><div className="input-wrapper"><span className="input-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg></span><input type="text" className="profile-input" value={instansi} onChange={e=>setInstansi(e.target.value)} /></div></div>
            <div className="form-group"><label>Peran</label><div className="input-wrapper"><span className="input-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/></svg></span><input type="text" className="profile-input" value="User (Peserta Magang)" disabled style={{color:'var(--gray-500)',background:'var(--gray-100)'}} /></div></div>
            <div className="save-btn-wrapper"><button type="button" className="btn btn-primary" onClick={handleSave}>Simpan Perubahan</button></div>
          </div>
        </div>
        <div className="magang-info-card"><h3>Informasi Magang</h3><p className="info-sub">Detail periode magang Anda</p>
          <div className="magang-info-grid">
            <div className="magang-info-item"><div className="mi-label">Tanggal Mulai</div><div className="mi-value">1 Januari 2026</div></div>
            <div className="magang-info-item"><div className="mi-label">Tanggal Selesai</div><div className="mi-value">30 Juni 2026</div></div>
            <div className="magang-info-item"><div className="mi-label">Durasi</div><div className="mi-value">6 Bulan</div></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profil;
