import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './SuperManage.css';
import SuperManagePhotoManager from './SuperManagePhotoManager';

const SuperManage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (user?.role !== 'superadmin') {
    return (
      <div className="super-manage-denied">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
        </svg>
        <h3>Akses Ditolak</h3>
        <p>Halaman ini hanya dapat diakses oleh Superadmin.</p>
      </div>
    );
  }

  const features = [
    {
      id: 'manajemen-penilaian',
      title: 'Manajemen Penilaian',
      description: 'Kelola penilaian performa peserta magang yang sudah difinalisasi. Lihat, tinjau, dan hapus penilaian final.',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14M5 12h14" />
          <circle cx="12" cy="12" r="10" />
        </svg>
      ),
      color: '#667eea',
      bgGradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      lightBg: 'linear-gradient(135deg, #ede9fe 0%, #e0e7ff 100%)',
      path: '/admin/manajemen-penilaian',
      stats: null,
    },
    {
      id: 'data-admin',
      title: 'Kelola Data Admin',
      description: 'Tambah, edit, dan hapus akun admin sistem. Hanya superadmin yang dapat mengelola data admin.',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          <circle cx="12" cy="12" r="10" strokeDasharray="4 4" />
        </svg>
      ),
      color: '#059669',
      bgGradient: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
      lightBg: 'linear-gradient(135deg, #d1fae5 0%, #bbf7d0 100%)',
      path: '/admin/super-manage/data-admin',
      stats: null,
    },
  ];

  return (
    <div className="super-manage-container">
      <div className="super-manage-header">
        <div className="super-manage-header-info">
          <div className="super-manage-header-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div>
            <h2 className="super-manage-title">Super Manage</h2>
            <p className="super-manage-subtitle">Fitur khusus yang hanya dapat diakses oleh Superadmin</p>
          </div>
        </div>
        <span className="super-manage-role-badge">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          Superadmin
        </span>
      </div>

      <div className="super-manage-grid">
        {features.map((feature) => (
          <div key={feature.id} className="super-manage-card" onClick={() => navigate(feature.path)}>
            <div className="smc-header">
              <div className="smc-icon" style={{ background: feature.bgGradient }}>
                {feature.icon}
              </div>
              <div className="smc-arrow">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </div>
            </div>
            <h3 className="smc-title">{feature.title}</h3>
            <p className="smc-desc">{feature.description}</p>
            <div className="smc-footer">
              <span className="smc-action" style={{ color: feature.color }}>
                Buka Fitur
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Card: Kelola Foto Absensi (as grid card, same as others) */}
      <div className="super-manage-grid">
        <div className="super-manage-card" style={{ padding: 0, overflow: 'visible' }}>
          <SuperManagePhotoManager />
        </div>
      </div>
    </div>
  );
};

export default SuperManage;
