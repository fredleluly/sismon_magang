import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const { login, isLoggedIn, user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoggedIn && user) {
      navigate(user.role === 'admin' ? '/admin' : '/dashboard');
    }
  }, [isLoggedIn, user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await login(email, password);
    setLoading(false);
    if (res.success && res.user) {
      showToast(res.message || 'Login berhasil!', 'success');
      setTimeout(() => navigate(res.user!.role === 'admin' ? '/admin' : '/dashboard'), 800);
    } else {
      showToast(res.message || 'Gagal login', 'error');
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  };

  return (
    <div className="auth-page login-page">
      <div className="login-bg"><img src="/assets/img/pln-building.jpeg" alt="PLN ICON+" /></div>
      <div className="float-circle"></div><div className="float-circle"></div><div className="float-circle"></div>
      <div className="login-card" style={shake ? { animation: 'shake 0.5s ease' } : {}}>
        <div className="login-logo"><img src="/assets/img/pln-logo.svg" alt="PLN ICON+" /></div>
        <h2>Selamat Datang</h2>
        <p className="login-sub">Sistem Monitoring Magang</p>
        <p className="login-sub-brand">PLN ICON+ Indonesia</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group"><label>Email</label>
            <div className="input-wrapper">
              <span className="input-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg></span>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="nama@example.com" required />
            </div>
          </div>
          <div className="form-group"><label>Kata Sandi</label>
            <div className="input-wrapper">
              <span className="input-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
            </div>
          </div>
          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? 'Memproses...' : <><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" x2="3" y1="12" y2="12"/></svg> Masuk</>}
          </button>
        </form>
        <div className="auth-link"><Link to="/register">+ Tambah Akun User</Link></div>
        <div className="info-box">
          <div className="info-title"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg> INFO APLIKASI</div>
          <div className="info-item">• <strong>Peserta Magang</strong> Gunakan akun supaya pekerjaan lebih efesien</div>
          <div className="info-item">• <strong>Admin</strong> Untuk akun admin hanya bisa di akses oleh PIC</div>
        </div>
      </div>
    </div>
  );
};

export default Login;
