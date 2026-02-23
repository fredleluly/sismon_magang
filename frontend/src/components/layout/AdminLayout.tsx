import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';
import Topbar from './Topbar';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

const AdminLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(() => {
    return localStorage.getItem('sidebarCollapsed') === 'true';
  });

  useEffect(() => {
    const onResize = () => { if (window.innerWidth > 768) setSidebarOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSidebarOpen(false); };
    window.addEventListener('resize', onResize); document.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('resize', onResize); document.removeEventListener('keydown', onKey); };
  }, []);

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', String(desktopCollapsed));
  }, [desktopCollapsed]);

  const handleLogout = () => {
    showToast('Berhasil keluar.', 'success');
    setTimeout(() => logout(), 800);
  };

  return (
    <div className={`app-wrapper${desktopCollapsed ? ' sidebar-collapsed' : ''}`}>
      <div className="app-bg"><img src="/assets/img/iconnet-banner.jpeg" alt="bg" /></div>
      <AdminSidebar
        onLogout={handleLogout}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={desktopCollapsed}
        onToggleCollapse={() => setDesktopCollapsed(!desktopCollapsed)}
      />
      <div className="main-content">
        <Topbar user={user} onMenuClick={() => setSidebarOpen(true)} />
        <div className="page-content page-enter"><Outlet /></div>
      </div>
      <button className="help-btn" onClick={() => showToast('Butuh bantuan? Hubungi IT Support PLN ICON+', 'info')}>?</button>
    </div>
  );
};

export default AdminLayout;
