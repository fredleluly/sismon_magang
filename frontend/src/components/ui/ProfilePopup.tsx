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
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    WorkLogAPI.getMyStats().then((res) => {
      if (res && res.success) setStats(res.data);
    });
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  if (!user) return null;
  const initials = getInitials(user.name);

  return (
    <div className="profile-popup active" ref={ref} style={{ display: 'block' }}>
      <div className="profile-popup-header">
        <div className="profile-popup-avatar">{initials}</div>
        <div className="profile-popup-info">
          <h4>{user.name}</h4>
          <p>{user.email}</p>
        </div>
      </div>
      <div className="profile-popup-body">
        <div className="profile-info-item">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
          </svg>
          <div>
            <span className="label">Instansi</span>
            <span className="value">{user.instansi || '-'}</span>
          </div>
        </div>
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
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          Lihat Profil Lengkap
        </button>
        <button className="profile-popup-btn logout" onClick={onLogout}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" x2="9" y1="12" y2="12" />
          </svg>
          Keluar
        </button>
      </div>
    </div>
  );
};

export default ProfilePopup;
