import React, { useEffect, useState } from 'react';
import { AttendanceAPI } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import './SuperManagePhotoManager.css';

const monthShort = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

const SuperManagePhotoManager: React.FC = () => {
  const { showToast } = useToast();
  const now = new Date();
  const [photoStats, setPhotoStats] = useState<Record<string, number>>({});
  const [selectedPhotoDates, setSelectedPhotoDates] = useState<string[]>([]);
  const [photoStatsLoading, setPhotoStatsLoading] = useState(false);
  const [showDeletePhotoConfirm, setShowDeletePhotoConfirm] = useState(false);
  const [deletingPhotos, setDeletingPhotos] = useState(false);
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());

  const loadPhotoStats = async () => {
    setPhotoStatsLoading(true);
    try {
      const res = await AttendanceAPI.getPhotoStats(month, year);
      if (res && res.success) {
        setPhotoStats(res.data || {});
      } else {
        setPhotoStats({});
      }
    } catch {
      setPhotoStats({});
    } finally {
      setPhotoStatsLoading(false);
    }
  };

  useEffect(() => {
    loadPhotoStats();
    setSelectedPhotoDates([]);
    // eslint-disable-next-line
  }, [month, year]);

  const togglePhotoDate = (date: string) => {
    setSelectedPhotoDates((prev) => (prev.includes(date) ? prev.filter((d) => d !== date) : [...prev, date]));
  };

  const selectAllPhotoDates = () => {
    if (selectedPhotoDates.length === Object.keys(photoStats).length) {
      setSelectedPhotoDates([]);
    } else {
      setSelectedPhotoDates(Object.keys(photoStats));
    }
  };

  const handleDeletePhotos = async () => {
    setDeletingPhotos(true);
    try {
      const res = await AttendanceAPI.bulkDeletePhotos(selectedPhotoDates);
      if (res && res.success) {
        showToast(res.message || 'Foto berhasil dihapus', 'success');
        setSelectedPhotoDates([]);
        loadPhotoStats();
      } else {
        showToast(res?.message || 'Gagal menghapus foto', 'error');
      }
    } catch {
      showToast('Gagal menghapus foto', 'error');
    } finally {
      setDeletingPhotos(false);
      setShowDeletePhotoConfirm(false);
    }
  };

  return (
    <div className="super-photo-card">
      <div className="super-photo-header">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
        <span className="super-photo-title">Kelola Foto Absensi</span>
        <span className="super-photo-badge">SUPERADMIN</span>
      </div>
      <div className="super-photo-desc">Pilih tanggal untuk menghapus foto absensi peserta.</div>
      {photoStatsLoading ? (
        <div style={{ textAlign: 'center', margin: '24px 0' }}>
          <span>Memuat data foto...</span>
        </div>
      ) : Object.keys(photoStats).length === 0 ? (
        <div style={{ textAlign: 'center', color: '#64748b', margin: '24px 0' }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          <div style={{ marginTop: 8 }}>Tidak ada foto absensi di bulan ini</div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
            <span className="super-photo-count">{Object.keys(photoStats).length} tanggal memiliki foto</span>
            <button className="super-photo-selectall" onClick={selectAllPhotoDates} style={{ marginLeft: 'auto' }}>
              {selectedPhotoDates.length === Object.keys(photoStats).length ? 'Batal Pilih Semua' : 'Pilih Semua'}
            </button>
          </div>
          <div className="super-photo-grid">
            {Object.entries(photoStats)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([dateStr, count]) => {
                const isSelected = selectedPhotoDates.includes(dateStr);
                const d = new Date(dateStr);
                const dayNum = d.getDate();
                const monthS = monthShort[d.getMonth()];
                return (
                  <div key={dateStr} className={`super-photo-date${isSelected ? ' selected' : ''}`} onClick={() => togglePhotoDate(dateStr)}>
                    <div className="super-photo-date-check">
                      {isSelected ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        <div className="super-photo-date-checkbox" />
                      )}
                    </div>
                    <span className="super-photo-date-day">{dayNum}</span>
                    <span className="super-photo-date-month">{monthS.toUpperCase()}</span>
                    <span className="super-photo-date-count">
                      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                      {count}
                    </span>
                  </div>
                );
              })}
          </div>
          {selectedPhotoDates.length > 0 && (
            <div className="super-photo-delete-action">
              <span className="super-photo-selected-info">{selectedPhotoDates.length} tanggal dipilih</span>
              <button className="super-photo-delete-btn" onClick={() => setShowDeletePhotoConfirm(true)} disabled={deletingPhotos}>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  <line x1="10" y1="11" x2="10" y2="17" />
                  <line x1="14" y1="11" x2="14" y2="17" />
                </svg>
                {deletingPhotos ? 'Menghapus...' : 'Hapus Foto'}
              </button>
            </div>
          )}
        </>
      )}
      {showDeletePhotoConfirm && (
        <div className="delete-photo-modal">
          <div className="delete-photo-modal-content">
            <h4>Konfirmasi Hapus Foto</h4>
            <p>Yakin ingin menghapus foto absensi pada {selectedPhotoDates.length} tanggal terpilih? Data kehadiran tetap tersimpan.</p>
            <div className="delete-photo-modal-actions">
              <button className="btn-outline" onClick={() => setShowDeletePhotoConfirm(false)} disabled={deletingPhotos}>
                Batal
              </button>
              <button className="btn btn-danger" onClick={handleDeletePhotos} disabled={deletingPhotos}>
                {deletingPhotos ? 'Menghapus...' : 'Hapus Foto'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperManagePhotoManager;
