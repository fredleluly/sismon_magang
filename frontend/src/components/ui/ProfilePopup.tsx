import React, { useEffect, useState, useRef } from 'react';
import type { User, WorkStats } from '../../types';
import { WorkLogAPI } from '../../services/api';
import { getInitials } from '../layout/Topbar';
import './ProfilePopup.css';

interface Props {
  user: User | null;
  onClose: () => void;
  onViewProfile: () => void;
  onLogout: () => void;
}

const ProfilePopup: React.FC<Props> = ({ user, onClose, onViewProfile, onLogout }) => {
  const [stats, setStats] = useState<WorkStats>({ berkas: 0, buku: 0, bundle: 0 });
  const [isClosing, setIsClosing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    WorkLogAPI.getMyStats().then((res) => {
      if (res && res.success) setStats(res.data);
    });
  }, []);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsClosing(true);
        setTimeout(() => onClose(), 300);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [onClose]);

  useEffect(() => {
    const handleScroll = () => {
      setIsClosing(true);
      setTimeout(() => onClose(), 300);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [onClose]);

  if (!user) return null;

  const calculateDuration = (dateStr?: string) => {
    if (!dateStr) return "0 hari";
    const start = new Date(dateStr);
    const now = new Date();
    let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
    let dayStart = new Date(start.getFullYear(), start.getMonth() + months, start.getDate());
    if (dayStart > now) {
      months--;
      dayStart = new Date(start.getFullYear(), start.getMonth() + months, start.getDate());
    }
    const days = Math.floor((now.getTime() - dayStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (months <= 0) return `${days} hari`;
    return days > 0 ? `${months} bulan ${days} hari` : `${months} bulan`;
  };

  const initials = getInitials(user.name);

  return (
    <div className={`profile-popup active ${isClosing ? 'closing' : ''}`} ref={ref} style={{ display: 'block' }}>
      <div className="profile-popup-header">
        <div className="profile-popup-avatar">{initials}</div>
        <div className="profile-popup-info">
          <h4>{user.name}</h4>
          <p>{user.email}</p>
          <div style={{ marginTop: '4px' }}>
            <span className="badge-pln" style={{ padding: '2px 10px', fontSize: '11px', borderRadius: '12px', background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', display: 'inline-block', fontWeight: '700' }}>
              {user.tanggalMasuk ? calculateDuration(user.tanggalMasuk) : "0 hari"}
            </span>
          </div>
        </div>
      </div>
      <div className="profile-popup-body">
        <div className="profile-info-item">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="4" />
          </svg>
          <div>
            <span className="label">Role</span>
            <span className="value">Peserta Magang</span>
          </div>
        </div>
      </div>
      <div className="profile-stats-popup">
        <div className="stat-popup-item">
          <span className="stat-popup-value">{stats.berkas}</span>
          <span className="stat-popup-label">Berkas</span>
        </div>
        <div className="stat-popup-item">
          <span className="stat-popup-value">{stats.buku}</span>
          <span className="stat-popup-label">Buku</span>
        </div>
        <div className="stat-popup-item">
          <span className="stat-popup-value">{stats.bundle}</span>
          <span className="stat-popup-label">Bundle</span>
        </div>
      </div>
      <div className="profile-popup-footer">
        <button
          className="profile-popup-btn edit"
          onClick={() => {
            onClose();
            onViewProfile();
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <span>Lihat Profil</span>
        </button>
        <button className="profile-popup-btn logout" onClick={onLogout}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" x2="9" y1="12" y2="12" />
          </svg>
          <span>Keluar</span>
        </button>
      </div>
    </div>
  );
};

export default ProfilePopup;
