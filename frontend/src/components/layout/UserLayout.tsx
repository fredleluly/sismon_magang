import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import Dashboard from '../../pages/user/Dashboard';
import Absensi from '../../pages/user/Absensi';
import InputPekerjaan from '../../pages/user/InputPekerjaan';
import MonitoringPekerjaan from '../../pages/user/MonitoringPekerjaan';
import LaporanKendala from '../../pages/user/LaporanKendala';
import Profil from '../../pages/user/Profil';
import ProfilePopup from '../ui/ProfilePopup';

const UserLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [popupOpen, setPopupOpen] = useState(false);

  useEffect(() => {
    const onResize = () => { if (window.innerWidth > 768) setSidebarOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSidebarOpen(false); };
    window.addEventListener('resize', onResize);
    document.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('resize', onResize); document.removeEventListener('keydown', onKey); };
  }, []);

  const handleLogout = () => {
    showToast('Berhasil keluar. Sampai jumpa!', 'success');
    setTimeout(() => logout(), 800);
  };

  const handleNavigate = (page: string) => {
    setCurrentPage(page);
    setPopupOpen(false);
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <Dashboard />;
      case 'absensi': return <Absensi />;
      case 'input-pekerjaan': return <InputPekerjaan />;
      case 'monitoring-pekerjaan': return <MonitoringPekerjaan />;
      case 'laporan-kendala': return <LaporanKendala />;
      case 'profil': return <Profil />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="app-wrapper">
      <div className="app-bg"><img src="/assets/img/iconnet-banner.jpeg" alt="bg" /></div>
      <Sidebar currentPage={currentPage} onNavigate={handleNavigate} onLogout={handleLogout} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-content">
        <Topbar user={user} onMenuClick={() => setSidebarOpen(true)} onAvatarClick={() => setPopupOpen(!popupOpen)} />
        {popupOpen && <ProfilePopup user={user} onClose={() => setPopupOpen(false)} onViewProfile={() => handleNavigate('profil')} onLogout={handleLogout} />}
        <div className="page-content page-enter">
          {renderPage()}
        </div>
      </div>
      <button className="help-btn" onClick={() => showToast('Butuh bantuan? Hubungi admin PLN ICON+', 'info')}>?</button>
    </div>
  );
};

export default UserLayout;
