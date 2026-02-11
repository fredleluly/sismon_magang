import React, { useState, useEffect } from 'react';
import { AttendanceAPI } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import type { Attendance } from '../../types';
import './AttendanceCalendar.css';

const AttendanceCalendar: React.FC = () => {
  const { showToast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [attendanceData, setAttendanceData] = useState<Attendance[]>([]);
  const [selectedDayData, setSelectedDayData] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(false);

  // Late threshold (same logic as QRCodeAdmin)
  const [lateThreshold, setLateThreshold] = useState<string>('08:00');
  const [isThresholdLoaded, setIsThresholdLoaded] = useState(false);

  const isLate = (jamMasuk: string | null | undefined): boolean => {
    if (!jamMasuk) return false;
    try {
      const normalized = jamMasuk.replace('.', ':');
      const [masukHours, masukMinutes] = normalized.split(':').map(Number);
      const [thresholdHours, thresholdMinutes] = lateThreshold.split(':').map(Number);
      if (isNaN(masukHours) || isNaN(masukMinutes) || isNaN(thresholdHours) || isNaN(thresholdMinutes)) return false;
      return masukHours * 60 + masukMinutes > thresholdHours * 60 + thresholdMinutes;
    } catch { return false; }
  };

  const getStatusWithLate = (att: Attendance): string => {
    if (typeof att.status === 'string' && att.status.toLowerCase() !== 'hadir') {
      return att.status;
    }
    return isLate(att.jamMasuk) ? 'Telat' : att.status || 'Hadir';
  };

  const getDaysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const getFirstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

  const handleDownloadPhoto = async (attendanceId: string, userName: string, date: string) => {
    try {
      showToast('Mengunduh foto...', 'info');
      const res = await AttendanceAPI.getPhoto(attendanceId);
      if (res && res.success && res.data.foto) {
        const link = document.createElement('a');
        link.href = res.data.foto;
        link.download = `Absensi_${userName.replace(/\s+/g, '_')}_${date}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('Foto berhasil diunduh', 'success');
      } else {
        showToast('Foto tidak tersedia', 'error');
      }
    } catch (error) {
      showToast('Gagal mengunduh foto', 'error');
    }
  };

  const loadAttendanceData = async () => {
    setLoading(true);
    try {
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59);

      const from = `${startOfMonth.getFullYear()}-${String(startOfMonth.getMonth() + 1).padStart(2, '0')}-${String(startOfMonth.getDate()).padStart(2, '0')}`;
      const to = `${endOfMonth.getFullYear()}-${String(endOfMonth.getMonth() + 1).padStart(2, '0')}-${String(endOfMonth.getDate()).padStart(2, '0')}`;

      const res = await AttendanceAPI.getAll(`from=${from}&to=${to}&limit=1000`);
      if (res && res.success) {
        setAttendanceData(res.data || []);
      } else {
        showToast('Gagal memuat data kehadiran', 'error');
      }
    } catch (error) {
      showToast('Error memuat data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAttendanceData();
  }, [currentDate]);

  // Load late threshold from backend
  useEffect(() => {
    const loadThreshold = async () => {
      const res = await AttendanceAPI.getLateThreshold();
      if (res && res.success) {
        setLateThreshold(res.data.lateThreshold);
      } else {
        const saved = localStorage.getItem('lateThreshold');
        if (saved) setLateThreshold(saved);
      }
      setIsThresholdLoaded(true);
    };
    loadThreshold();
  }, []);

  const getAttendanceForDay = (day: number): Attendance[] => {
    // Create date for the specific day in current month
    const targetDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    
    // Format to YYYY-MM-DD using local time components to avoid UTC shift
    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const date = String(targetDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${date}`;

    return attendanceData.filter((a) => {
      // Backend returns ISO string (e.g. 2024-02-11T00:00:00.000Z)
      // We just need the date part
      return a.tanggal.toString().split('T')[0] === dateStr;
    });
  };

  const handlePreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const handleDayClick = (day: number) => {
    const dayData = getAttendanceForDay(day);
    setSelectedDayData(dayData);
  };

  const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const emptyDays = Array.from({ length: firstDay }, (_, i) => i);

  const getAttendanceCount = (day: number) => {
    return getAttendanceForDay(day).length;
  };

  const getTotalPeserta = () => {
    const uniqueUsers = new Set(attendanceData.map((a) => (typeof a.userId === 'string' ? a.userId : a.userId?._id)));
    return uniqueUsers.size;
  };

  return (
    <div className="attendance-calendar-container">
      <div className="page-header">
        <h1>Kalender Kehadiran</h1>
        <p>Lihat data kehadiran peserta magang per hari</p>
      </div>

      <div className="calendar-wrapper">
        <div className="calendar-card">
          <div className="calendar-header">
            <button className="calendar-nav-btn" onClick={handlePreviousMonth}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </button>
            <h2 className="calendar-title">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h2>
            <button className="calendar-nav-btn" onClick={handleNextMonth}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          </div>

          <div className="calendar-day-names">
            {dayNames.map((day) => (
              <div key={day} className="day-name">
                {day}
              </div>
            ))}
          </div>

          <div className="calendar-grid">
            {emptyDays.map((_, i) => (
              <div key={`empty-${i}`} className="calendar-empty"></div>
            ))}
            {days.map((day) => {
              const count = getAttendanceCount(day);
              const isSelected =
                selectedDayData.length > 0 &&
                selectedDayData[0]?.tanggal.toString().split('T')[0] ===
                  `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              return (
                <div key={day} className={`calendar-day ${count > 0 ? 'has-data' : ''} ${isSelected ? 'selected' : ''}`} onClick={() => handleDayClick(day)} title={`${count} orang absen`}>
                  <div className="day-number">{day}</div>
                  {count > 0 && <div className="day-badge">{count}</div>}
                </div>
              );
            })}
          </div>
        </div>

        <div className="attendance-details">
          <div className="details-header">
            <h3>Detail Kehadiran</h3>
          </div>

          {selectedDayData.length === 0 ? (
            <div className="no-selection">
              <p>Pilih tanggal untuk melihat detail kehadiran</p>
            </div>
          ) : (
            <div className="details-content">
              <div className="day-info">
                <h4>{new Date(selectedDayData[0]?.tanggal).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</h4>
                <p>{selectedDayData.length} peserta hadir</p>
              </div>

              <table className="attendance-table">
                <thead>
                  <tr>
                    <th>No</th>
                    <th>Nama</th>
                    <th>Institusi</th>
                    <th>Jam Masuk</th>
                    <th>Status</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedDayData.map((att, i) => (
                    <tr key={att._id}>
                      <td>{i + 1}</td>
                      <td className="name-cell">{typeof att.userId === 'string' ? 'Unknown' : att.userId?.name || 'Unknown'}</td>
                      <td>{typeof att.userId === 'string' ? '-' : att.userId?.instansi || '-'}</td>
                      <td className="time-cell">{att.jamMasuk || '-'}</td>
                      <td>
                        <span className={`status-badge status-${(isThresholdLoaded ? getStatusWithLate(att) : att.status).toLowerCase().replace(/\s+/g, '-')}`}>{isThresholdLoaded ? getStatusWithLate(att) : att.status}</span>
                      </td>
                      <td>
                        {att.fotoAbsensi && (
                          <button
                            className="btn-icon-small"
                            onClick={() =>
                              handleDownloadPhoto(
                                att._id,
                                typeof att.userId === 'string' ? 'User' : att.userId?.name || 'User',
                                new Date(att.tanggal).toISOString().split('T')[0]
                              )
                            }
                            title="Download Foto"
                            style={{
                              background: 'none',
                              border: '1px solid var(--gray-300)',
                              borderRadius: '4px',
                              padding: '4px',
                              cursor: 'pointer',
                              color: 'var(--primary-600)',
                            }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                              <polyline points="7 10 12 15 17 10"></polyline>
                              <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="summary-stats">
            <div className="stat-box">
              <div className="stat-label">Total Peserta</div>
              <div className="stat-value">{getTotalPeserta()}</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">Hari Ini</div>
              <div className="stat-value">{getAttendanceCount(new Date().getDate())}</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">Bulan Ini</div>
              <div className="stat-value">{attendanceData.length}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AttendanceCalendar;
