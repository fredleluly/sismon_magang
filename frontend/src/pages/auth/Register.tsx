import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

const Register: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [instansi, setInstansi] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await register(name, email, password, instansi);
    setLoading(false);
    if (res.success) {
      showToast('Pendaftaran berhasil! Silakan login.', 'success');
      setTimeout(() => navigate('/login'), 1200);
    } else {
      showToast(res.message || 'Gagal mendaftar', 'error');
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-left">
        <div className="logo-area"><img src="/assets/img/pln-logo.svg" alt="PLN ICON+" style={{width:70,height:70,borderRadius:12}} /></div>
        <h1>Mulai Perjalanan<br /><span>Magang Anda</span></h1>
        <p className="auth-subtitle">Bergabung bersama PLN ICON+ Indonesia untuk masa depan yang lebih cerah.</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group"><label>Nama Lengkap</label>
            <div className="input-wrapper"><span className="input-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></span>
            <input type="text" value={name} onChange={e=>setName(e.target.value)} placeholder="Masukkan nama lengkap Anda" required /></div>
          </div>
          <div className="form-group"><label>Email Institusi / Pribadi</label>
            <div className="input-wrapper"><span className="input-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg></span>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="nama@email.com" required /></div>
          </div>
          <div className="form-group"><label>Kata Sandi</label>
            <div className="input-wrapper"><span className="input-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Buat kata sandi yang kuat" required minLength={6} /></div>
          </div>
          <div className="form-group"><label>Instansi / Universitas</label>
            <div className="input-wrapper"><span className="input-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg></span>
            <input type="text" value={instansi} onChange={e=>setInstansi(e.target.value)} placeholder="Asal Universitas atau Sekolah" required /></div>
          </div>
          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? 'Memproses...' : 'Buat Akun Sekarang'}
          </button>
        </form>
        <div className="auth-link">Sudah punya akun? <Link to="/login">Masuk di sini</Link></div>
      </div>
      <div className="auth-right">
        <div className="hero-bg"><img src="/assets/img/pln-building.jpeg" alt="PLN ICON+" /></div>
        <div className="float-circle"></div><div className="float-circle"></div><div className="float-circle"></div>
        <div className="hero-content">
          <div className="hero-badge">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            <span>Sistem Monitoring Magang</span>
          </div>
          <h2>Tingkatkan Potensi,<br /><span>Wujudkan Inovasi.</span></h2>
          <p className="hero-desc">Bergabung dengan ekosistem digital PLN ICON+ untuk pengalaman magang yang terstruktur, profesional, dan berorientasi masa depan.</p>
          <div className="hero-features">
            <div className="feature-item"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> Monitoring Real-time</div>
            <div className="feature-item"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> Evaluasi Terstruktur</div>
            <div className="feature-item"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> Sertifikat Digital</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
