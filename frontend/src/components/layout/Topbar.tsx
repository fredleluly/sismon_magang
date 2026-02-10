import React from 'react';
import type { User } from '../../types';

interface TopbarProps {
  user: User | null;
  onMenuClick: () => void;
  onAvatarClick?: () => void;
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
}

const Topbar: React.FC<TopbarProps> = ({ user, onMenuClick, onAvatarClick }) => {
  const initials = user ? getInitials(user.name) : 'U';

  return (
    <header className="topbar">
      <button className="mobile-menu-btn" onClick={onMenuClick} aria-label="Menu">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="3" x2="21" y1="6" y2="6" />
          <line x1="3" x2="21" y1="12" y2="12" />
          <line x1="3" x2="21" y1="18" y2="18" />
        </svg>
      </button>
      <span className="topbar-title">Sistem Monitoring Magang</span>
      <div className="topbar-right">
        <div className="topbar-search">
          <span className="search-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" x2="16.65" y1="21" y2="16.65" />
            </svg>
          </span>
          <input type="text" placeholder="Cari..." />
        </div>
        <div className="topbar-avatar" onClick={onAvatarClick} style={{ cursor: 'pointer' }} title="Profil Saya">
          {initials}
        </div>
      </div>
    </header>
  );
};

export default Topbar;
