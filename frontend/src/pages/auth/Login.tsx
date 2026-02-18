import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import gsap from 'gsap';
import './Login.css';

const Login: React.FC = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoggedIn, user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  // Refs for GSAP
  const pageRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const blob1Ref = useRef<HTMLDivElement>(null);
  const blob2Ref = useRef<HTMLDivElement>(null);

  // Detect if input looks like email
  const inputMode = useMemo(() => {
    if (!identifier) return 'none';
    return identifier.includes('@') ? 'email' : 'name';
  }, [identifier]);

  useEffect(() => {
    if (isLoggedIn && user) {
      navigate(user.role === 'admin' ? '/admin' : '/dashboard');
    }
  }, [isLoggedIn, user, navigate]);

  // GSAP entrance animations
  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      // Hero panel animations
      tl.fromTo('.login-v2-hero .hero-badge',
        { opacity: 0, y: -20 },
        { opacity: 1, y: 0, duration: 0.6 }
      )
      .fromTo('.login-v2-hero h1',
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 0.7 },
        '-=0.3'
      )
      .fromTo('.login-v2-hero .hero-desc',
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.6 },
        '-=0.4'
      )
      .fromTo('.login-v2-hero .stat-item',
        { opacity: 0, y: 20, scale: 0.9 },
        { opacity: 1, y: 0, scale: 1, duration: 0.5, stagger: 0.1 },
        '-=0.3'
      );

      // Card animations
      tl.fromTo(cardRef.current,
        { opacity: 0, x: 40, scale: 0.97 },
        { opacity: 1, x: 0, scale: 1, duration: 0.8 },
        '-=0.8'
      );

      // Form elements stagger
      tl.fromTo('.login-v2-card .card-logo, .login-v2-card .card-greeting, .login-v2-card h2, .login-v2-card .card-sub',
        { opacity: 0, y: 15 },
        { opacity: 1, y: 0, duration: 0.4, stagger: 0.08 },
        '-=0.5'
      )
      .fromTo('.v2-input-group',
        { opacity: 0, x: -20 },
        { opacity: 1, x: 0, duration: 0.4, stagger: 0.12 },
        '-=0.2'
      )
      .fromTo('.v2-submit',
        { opacity: 0, y: 10, scale: 0.95 },
        { opacity: 1, y: 0, scale: 1, duration: 0.4 },
        '-=0.1'
      );

      // Blob floating animation (infinite)
      if (blob1Ref.current) {
        gsap.to(blob1Ref.current, {
          x: 30, y: 20, duration: 6, repeat: -1, yoyo: true, ease: 'sine.inOut'
        });
      }
      if (blob2Ref.current) {
        gsap.to(blob2Ref.current, {
          x: -25, y: -15, duration: 8, repeat: -1, yoyo: true, ease: 'sine.inOut'
        });
      }

      // Floating particles
      gsap.utils.toArray<HTMLElement>('.particle').forEach((p, i) => {
        gsap.to(p, {
          y: `random(-40, 40)`, x: `random(-30, 30)`,
          duration: `random(4, 8)`, repeat: -1, yoyo: true,
          ease: 'sine.inOut', delay: i * 0.4,
        });
        gsap.fromTo(p,
          { opacity: 0, scale: 0 },
          { opacity: Number(p.dataset.opacity) || 0.4, scale: 1, duration: 1, delay: 0.5 + i * 0.15, ease: 'back.out(1.4)' }
        );
      });
    }, pageRef);

    return () => ctx.revert();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Button press animation
    if (formRef.current) {
      const btn = formRef.current.querySelector('.v2-submit');
      if (btn) gsap.to(btn, { scale: 0.97, duration: 0.1, yoyo: true, repeat: 1 });
    }

    const res = await login(identifier, password);
    setLoading(false);

    if (res.success && res.user) {
      if (cardRef.current) {
        gsap.to(cardRef.current, { scale: 1.02, duration: 0.3, yoyo: true, repeat: 1 });
      }
      showToast(res.message || 'Login berhasil!', 'success');
      setTimeout(() => navigate(res.user!.role === 'admin' ? '/admin' : '/dashboard'), 800);
    } else {
      const errorMsg = res.message || 'Gagal login';
      if (errorMsg.toLowerCase().includes('password') || errorMsg.toLowerCase().includes('kata sandi')) {
        showToast('Password yang Anda masukkan salah!', 'error');
      } else if (errorMsg.toLowerCase().includes('email') || errorMsg.toLowerCase().includes('tidak ditemukan')) {
        showToast('Email/nama tidak terdaftar!', 'error');
      } else {
        showToast(errorMsg, 'error');
      }

      // GSAP shake
      if (cardRef.current) {
        gsap.fromTo(cardRef.current,
          { x: -8 },
          { x: 8, duration: 0.08, repeat: 5, yoyo: true, ease: 'power1.inOut',
            onComplete: () => { gsap.set(cardRef.current, { x: 0 }); }
          }
        );
      }
    }
  };

  const particles = [
    { size: 6, top: '15%', left: '20%', color: 'rgba(0,212,255,0.5)', opacity: 0.5 },
    { size: 4, top: '70%', left: '15%', color: 'rgba(255,214,0,0.5)', opacity: 0.4 },
    { size: 8, top: '30%', left: '75%', color: 'rgba(255,255,255,0.3)', opacity: 0.3 },
    { size: 5, top: '80%', left: '70%', color: 'rgba(0,212,255,0.4)', opacity: 0.4 },
    { size: 3, top: '45%', left: '10%', color: 'rgba(255,255,255,0.4)', opacity: 0.4 },
    { size: 6, top: '20%', left: '60%', color: 'rgba(102,126,234,0.4)', opacity: 0.35 },
    { size: 4, top: '60%', left: '40%', color: 'rgba(0,212,255,0.35)', opacity: 0.35 },
    { size: 7, top: '85%', left: '85%', color: 'rgba(255,214,0,0.3)', opacity: 0.3 },
  ];

  return (
    <div className="login-page-v2" ref={pageRef}>
      {/* ===== LEFT — Hero ===== */}
      <div className="login-v2-left">
        <div className="hero-bg-img">
          <img src="/assets/img/pln-building.jpeg" alt="PLN ICON+" />
        </div>
        <div className="grid-pattern"></div>
        <div className="mesh-blob mesh-blob-1" ref={blob1Ref}></div>
        <div className="mesh-blob mesh-blob-2" ref={blob2Ref}></div>
        <div className="mesh-blob mesh-blob-3"></div>

        <div>
          {particles.map((p, i) => (
            <div key={i} className="particle" data-opacity={p.opacity}
              style={{ width: p.size, height: p.size, top: p.top, left: p.left, background: p.color, opacity: 0 }}
            />
          ))}
        </div>

        <div className="login-v2-hero">
          <div className="hero-badge">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            <span>PLN ICON+ Indonesia</span>
          </div>
          <h1>Sistem Monitoring<span>Magang Digital</span></h1>
          <p className="hero-desc">Platform terintegrasi untuk monitoring, evaluasi, dan pelaporan aktivitas magang secara real-time.</p>
          <div className="hero-stats">
            <div className="stat-item">
              <div className="stat-number">24<span>/7</span></div>
              <div className="stat-label">Monitoring</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">100<span>%</span></div>
              <div className="stat-label">Digital</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">Real<span>-time</span></div>
              <div className="stat-label">Tracking</div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== RIGHT — Form ===== */}
      <div className="login-v2-right">
        <div className="login-v2-card" ref={cardRef}>
          <div className="card-logo">
            <img src="/assets/img/pln-logo.svg" alt="PLN ICON+" />
          </div>
          <div className="card-greeting">Selamat Datang</div>
          <h2>Masuk ke Akun Anda</h2>
          <p className="card-sub">Gunakan email atau nama untuk masuk</p>

          <form className="login-v2-form" onSubmit={handleSubmit} ref={formRef}>
            <div className="v2-input-group">
              <label className="v2-input-label">
                {inputMode === 'email' ? (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                )}
                Email / Nama
              </label>
              <div className="v2-input-wrap">
                <input type="text" className="v2-input" value={identifier} onChange={e => setIdentifier(e.target.value)}
                  placeholder="email@example.com atau nama" required autoComplete="username" />
                <span className="v2-input-icon">
                  {inputMode === 'email' ? (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  )}
                </span>
              </div>
              {identifier && (
                <div className={`v2-input-mode-indicator ${inputMode === 'email' ? 'is-email' : 'is-name'}`}>
                  {inputMode === 'email' ? (
                    <><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg> Mode: Email</>
                  ) : (
                    <><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> Mode: Nama</>
                  )}
                </div>
              )}
            </div>

            <div className="v2-input-group">
              <label className="v2-input-label">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                Kata Sandi
              </label>
              <div className="v2-input-wrap">
                <input type={showPassword ? 'text' : 'password'} className="v2-input" value={password}
                  onChange={e => setPassword(e.target.value)} placeholder="••••••••" required autoComplete="current-password" />
                <span className="v2-input-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                </span>
                <button type="button" className="v2-toggle-pw" onClick={() => setShowPassword(!showPassword)} title={showPassword ? 'Sembunyikan' : 'Tampilkan'}>
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
            </div>

            <button type="submit" className="v2-submit" disabled={loading}>
              {loading ? (
                <div className="v2-spinner"></div>
              ) : (
                <><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" x2="3" y1="12" y2="12"/></svg> Masuk</>
              )}
            </button>
          </form>

          <div className="v2-brand">
            &copy; {new Date().getFullYear()} PLN ICON+ &middot; Sistem Monitoring Magang
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
