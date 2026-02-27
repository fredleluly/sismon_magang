import React, { useState, useEffect } from 'react';
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
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDate = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    };
    return date.toLocaleDateString('id-ID', options);
  };

  const formatTime = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    };
    return date.toLocaleTimeString('id-ID', options).replace(/\./g, ':');
  };

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
        <div className="topbar-clock">
          <div className="clock-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </div>
          <div className="clock-text">
            <span className="clock-date">{formatDate(currentTime)}</span>
            <span className="clock-dot">•</span>
            <span className="clock-time">{formatTime(currentTime)}</span>
          </div>
        </div>
        <div className="topbar-avatar" onClick={onAvatarClick} style={{ cursor: 'pointer' }} title="Profil Saya">
          {initials}
        </div>
      </div>
    </header>
  );
};

export default Topbar;
