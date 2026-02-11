import React, { useEffect, useState, useRef } from 'react';
import { QRCodeAPI, UsersAPI, getToken, AttendanceAPI } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import type { QRCode, Attendance } from '../../types';
import QRCodeLib from 'qrcode';
import * as XLSX from 'xlsx';
import './QRCodeAdmin.css';

const QRCodeAdmin: React.FC = () => {
  const { showToast } = useToast();
  const [todayQR, setTodayQR] = useState<QRCode | null>(null);
  const [history, setHistory] = useState<QRCode[]>([]);
  const [totalPeserta, setTotalPeserta] = useState(0);
  const [attendanceList, setAttendanceList] = useState<any[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [editingAtt, setEditingAtt] = useState<any | null>(null);
  const [editStatus, setEditStatus] = useState<string>('Hadir');
  const [editJamMasuk, setEditJamMasuk] = useState<string>('');

  // Calendar states
  const [currentDate, setCurrentDate] = useState(new Date());
  const [attendanceData, setAttendanceData] = useState<Attendance[]>([]);
  const [selectedDayData, setSelectedDayData] = useState<Attendance[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);

  // Late threshold setting
  const [lateThreshold, setLateThreshold] = useState<string>('08:00');
  const [isEditingThreshold, setIsEditingThreshold] = useState(false);
  const [isThresholdLoaded, setIsThresholdLoaded] = useState(false);

  const load = async () => {
    const qr = await QRCodeAPI.getToday();
    if (qr && qr.success && qr.data) {
      setTodayQR(qr.data);
    }
    const hist = await QRCodeAPI.getHistory();
    if (hist && hist.success) setHistory(hist.data || []);
    const users = await UsersAPI.getAll();
    if (users && users.success) setTotalPeserta(users.data.length);
    loadAttendance();
  };

  useEffect(() => {
    if (todayQR && canvasRef.current) {
      const url = window.location.origin + '/absensi-scan?token=' + todayQR.token;
      QRCodeLib.toCanvas(canvasRef.current, url, { width: 220, color: { dark: '#0a6599' } }, (error) => {
        if (error) console.error('QR Gen Error:', error);
      });
    }
  }, [todayQR]);

  const loadAttendance = async () => {
    try {
      const res = await fetch('/api/attendance/today', { headers: { Authorization: 'Bearer ' + getToken() } });
      const d = await res.json();
      if (d.success) setAttendanceList(d.data || []);
    } catch {}
  };

  // Calendar functions
  const getDaysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const getFirstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

  const loadAttendanceData = async () => {
    setCalendarLoading(true);
    try {
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59);
      const from = startOfMonth.toISOString().split('T')[0];
      const to = endOfMonth.toISOString().split('T')[0];
      const res = await AttendanceAPI.getAll(`from=${from}&to=${to}&limit=1000`);
      if (res && res.success) {
        setAttendanceData(res.data || []);
      } else {
        showToast('Gagal memuat data kehadiran', 'error');
      }
    } catch (error) {
      showToast('Error memuat data', 'error');
    } finally {
      setCalendarLoading(false);
    }
  };

  const getAttendanceForDay = (day: number): Attendance[] => {
    const targetDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const dateStr = toDateString(targetDate);
    return attendanceData.filter((a) => a.tanggal.toString().split('T')[0] === dateStr);
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

  const getAttendanceCount = (day: number) => {
    return getAttendanceForDay(day).length;
  };

  const getTotalPeserta = () => {
    const uniqueUsers = new Set(attendanceData.map((a) => (typeof a.userId === 'string' ? a.userId : a.userId?._id)));
    return uniqueUsers.size;
  };

  // Helper untuk convert date ke YYYY-MM-DD tanpa timezone conversion
  const toDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    load();
    loadAttendanceData();
    const iv = setInterval(loadAttendance, 15000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    loadAttendanceData();
  }, [currentDate]);

  const handleCopyToken = async () => {
    if (!todayQR?.token) return;
    try {
      await navigator.clipboard.writeText(todayQR.token);
      showToast('Token berhasil disalin!', 'success');
    } catch {
      showToast('Gagal menyalin token', 'error');
    }
  };

  const handleGenerate = async () => {
    const res = await QRCodeAPI.generate();
    if (res && res.success) {
      showToast('QR Code berhasil di-generate!', 'success');
      load();
    } else showToast(res?.message || 'Gagal generate', 'error');
  };

  const openEditStatus = (att: any) => {
    console.log('openEditStatus called with:', att);
    setEditingAtt(att);
    setEditStatus(att.status || 'Hadir');
    // Convert jamMasuk to time input format (HH:MM) - handle both HH:MM and HH.MM
    const jam = att.jamMasuk ? att.jamMasuk.replace('.', ':') : '00:00';
    setEditJamMasuk(jam);
    console.log('Modal should be visible now, editingAtt:', att);
  };

  const closeEdit = () => {
    setEditingAtt(null);
    setEditStatus('Hadir');
    setEditJamMasuk('');
  };

  const handleSaveStatus = async () => {
    if (!editingAtt) return;
    try {
      const res = await AttendanceAPI.updateStatus(editingAtt._id, editStatus, editJamMasuk);
      if (res && res.success) {
        showToast('Data kehadiran berhasil diperbarui', 'success');
        closeEdit();
        // Refresh all data
        const [attRes] = await Promise.all([
          AttendanceAPI.getAll(`from=${new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString().split('T')[0]}&to=${new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59).toISOString().split('T')[0]}&limit=1000`),
          loadAttendance(),
        ]);
        if (attRes && attRes.success) {
          const newData = attRes.data || [];
          setAttendanceData(newData);
          // Refresh selectedDayData if a day was selected
          if (selectedDayData.length > 0) {
            const selectedDate = selectedDayData[0]?.tanggal.toString().split('T')[0];
            setSelectedDayData(newData.filter((a: any) => a.tanggal.toString().split('T')[0] === selectedDate));
          }
        }
      } else {
        showToast(res?.message || 'Gagal memperbarui data', 'error');
      }
    } catch (err) {
      showToast('Gagal memperbarui data', 'error');
    }
  };

  // Helper function to check if time is late - accept both HH:MM and HH.MM formats
  const isLate = (jamMasuk: string | null | undefined): boolean => {
    if (!jamMasuk) return false;
    try {
      // Replace period with colon to handle both formats (11.43 or 11:43)
      const normalized = jamMasuk.replace('.', ':');
      const [masukHours, masukMinutes] = normalized.split(':').map(Number);
      const [thresholdHours, thresholdMinutes] = lateThreshold.split(':').map(Number);

      if (isNaN(masukHours) || isNaN(masukMinutes) || isNaN(thresholdHours) || isNaN(thresholdMinutes)) {
        return false;
      }

      const masukTime = masukHours * 60 + masukMinutes;
      const thresholdTime = thresholdHours * 60 + thresholdMinutes;
      return masukTime > thresholdTime;
    } catch {
      return false;
    }
  };

  const getStatusWithLate = (att: any): string => {
    if (typeof att.status === 'string' && att.status.toLowerCase() !== 'hadir') {
      return att.status;
    }
    return isLate(att.jamMasuk) ? 'Telat' : att.status || 'Hadir';
  };

  const handleSaveThreshold = async () => {
    // Save to backend
    const res = await AttendanceAPI.setLateThreshold(lateThreshold);
    if (res && res.success) {
      // Also save to localStorage for fallback
      localStorage.setItem('lateThreshold', lateThreshold);
      showToast('Jam telat berhasil diatur ke ' + lateThreshold, 'success');
      setIsEditingThreshold(false);
    } else {
      showToast(res?.message || 'Gagal menyimpan', 'error');
    }
  };

  const handleResetThreshold = () => {
    setLateThreshold('08:00');
  };

  const downloadDayExcel = () => {
    if (selectedDayData.length === 0) {
      showToast('Tidak ada data untuk diunduh', 'error');
      return;
    }

    try {
      // Prepare data
      const selectedDate = new Date(selectedDayData[0]?.tanggal).toLocaleDateString('id-ID', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      // Create worksheet data
      const wsData: any[] = [['DATA KEHADIRAN'], [`Tanggal: ${selectedDate}`], [`Total Peserta: ${selectedDayData.length}`], [], ['No', 'Nama', 'Institusi', 'Jam Masuk', 'Status']];

      // Add attendance records
      selectedDayData.forEach((att, index) => {
        const name = typeof att.userId === 'string' ? 'Unknown' : att.userId?.name || 'Unknown';
        const instansi = typeof att.userId === 'string' ? '-' : att.userId?.instansi || '-';
        const status = isThresholdLoaded ? getStatusWithLate(att) : att.status;
        wsData.push([index + 1, name, instansi, att.jamMasuk || '-', status]);
      });

      // Create workbook and worksheet
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Kehadiran');

      // Set column widths
      ws['!cols'] = [{ wch: 5 }, { wch: 20 }, { wch: 20 }, { wch: 12 }, { wch: 12 }];

      // Generate filename
      const dateStr = new Date(selectedDayData[0]?.tanggal).toISOString().split('T')[0];
      const filename = `Kehadiran-${dateStr}.xlsx`;

      // Download
      XLSX.writeFile(wb, filename);
      showToast('Excel berhasil diunduh!', 'success');
    } catch (error) {
      console.error('Error downloading Excel:', error);
      showToast('Gagal mengunduh Excel', 'error');
    }
  };

  // Load late threshold from localStorage on mount
  useEffect(() => {
    const loadThreshold = async () => {
      // Try to load from backend first
      const res = await AttendanceAPI.getLateThreshold();
      if (res && res.success) {
        setLateThreshold(res.data.lateThreshold);
        localStorage.setItem('lateThreshold', res.data.lateThreshold);
      } else {
        // Fallback to localStorage
        const saved = localStorage.getItem('lateThreshold');
        if (saved) setLateThreshold(saved);
      }
      setIsThresholdLoaded(true);
    };
    loadThreshold();
  }, []);

  const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <>
      <div className="page-header">
        <h1>Kelola QR Code</h1>
        <p>Generate QR Code untuk absensi harian peserta magang</p>
      </div>
      <div className="qr-date-bar">
        <div className="date-info">
          <div className="date-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
              <line x1="16" x2="16" y1="2" y2="6" />
              <line x1="8" x2="8" y1="2" y2="6" />
              <line x1="3" x2="21" y1="10" y2="10" />
            </svg>
          </div>
          <div className="date-text">
            <h3>{today}</h3>
            <p>Generate QR Code untuk hari ini</p>
          </div>
        </div>
      </div>
      <div className="qr-layout">
        <div className="qr-gen-card">
          <div className="qr-gen-header">
            <h3>Generate QR Code</h3>
          </div>
          <p className="qr-gen-sub">QR Code akan berlaku untuk hari ini saja</p>
          <div className="qr-preview-admin">{todayQR ? <canvas ref={canvasRef} /> : <span className="qr-preview-text">Klik tombol di bawah untuk generate</span>}</div>
          {todayQR && (
            <div className="qr-token-container">
              <div className="qr-token-text">
                <strong>Token:</strong>
                <code className="qr-token-code">{todayQR.token}</code>
              </div>
              <button onClick={handleCopyToken} className="qr-copy-btn" title="Salin token ke clipboard">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                  <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                </svg>
                Copy
              </button>
            </div>
          )}
          <button className="btn btn-primary btn-full" onClick={handleGenerate} style={{ marginTop: 8 }}>
            Generate QR Code
          </button>
        </div>
        <div>
          <div className="qr-status-card">
            <div className="qr-status-header">
              <h3>Status QR Code Hari Ini</h3>
            </div>
            <div className="qr-status-counts">
              <div className="qr-count-box total">
                <div className="qr-count-box-value">{totalPeserta}</div>
                <div className="qr-count-box-label">Total Peserta</div>
              </div>
              <div className="qr-count-box scanned">
                <div className="qr-count-box-value">{todayQR?.scannedBy?.length || attendanceList.length || 0}</div>
                <div className="qr-count-box-label">Sudah Absen</div>
              </div>
            </div>
          </div>

          {/* Late Threshold Setting */}
          <div className="qr-status-card" style={{ marginTop: 16 }}>
            <div className="qr-status-header">
              <h3>Pengaturan Jam Telat</h3>
            </div>
            {!isEditingThreshold ? (
              <div style={{ padding: '12px 0' }}>
                <div style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }}>Jam Batas Telat:</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#0a6599' }}>{lateThreshold}</div>
                  <button onClick={() => setIsEditingThreshold(true)} style={{ padding: '6px 12px', background: '#e2e8f0', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                    Edit
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ padding: '12px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>
                  Masukkan Jam Batas Telat (format HH:MM):
                  <input
                    type="time"
                    value={lateThreshold}
                    onChange={(e) => setLateThreshold(e.target.value)}
                    style={{
                      marginTop: 6,
                      padding: '8px 10px',
                      border: '1px solid #cbd5e1',
                      borderRadius: 6,
                      fontSize: 14,
                      width: '100%',
                      fontFamily: 'inherit',
                    }}
                  />
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={handleSaveThreshold} style={{ flex: 1, padding: '8px 12px', background: '#22c55e', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                    Simpan
                  </button>
                  <button onClick={() => setIsEditingThreshold(false)} style={{ flex: 1, padding: '8px 12px', background: '#cbd5e1', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                    Batal
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="qr-history-card hidden">
        <h3>Daftar Kehadiran Hari Ini</h3>
        {attendanceList.length === 0 ? (
          <p className="qr-history-empty">Belum ada peserta absen</p>
        ) : (
          <table className="qr-attendance-table">
            <thead>
              <tr>
                <th>No</th>
                <th>Nama</th>
                <th>Jam Masuk</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {attendanceList.map((r: any, i: number) => (
                <tr key={r._id}>
                  <td>{i + 1}</td>
                  <td className="qr-attendance-name">{r.userId?.name || 'Unknown'}</td>
                  <td className="qr-attendance-time">{r.jamMasuk || '-'}</td>
                  <td>
                    <span className={`qr-status-badge ${isThresholdLoaded ? getStatusWithLate(r).toLowerCase() : r.status?.toLowerCase()}`}>{isThresholdLoaded ? getStatusWithLate(r) : r.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="qr-history-card hidden">
        <h3>Riwayat QR Code</h3>
        <p className="qr-history-subtitle">7 hari terakhir</p>
        {history.length === 0 ? (
          <p className="qr-history-empty">Belum ada riwayat</p>
        ) : (
          history.map((h) => {
            const dt = new Date(h.tanggal).toLocaleDateString('id-ID', {
              weekday: 'long',
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            });
            return (
              <div key={h._id} className="qr-history-item">
                <div className="qr-history-date">{dt}</div>
                <div className="qr-history-count">
                  <span className="qr-history-count-value">{h.scannedCount || 0}</span>
                  <span className="qr-history-count-label">scan</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* CALENDAR SECTION */}
      <div className="calendar-wrapper">
        <div className="calendar-card">
          <div className="calendar-header">
            <button className="calendar-nav-btn" onClick={handlePreviousMonth}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </button>
            <h2 className="calendar-title">
              {['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'][currentDate.getMonth()]} {currentDate.getFullYear()}
            </h2>
            <button className="calendar-nav-btn" onClick={handleNextMonth}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          </div>

          <div className="calendar-day-names">
            {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map((day) => (
              <div key={day} className="day-name">
                {day}
              </div>
            ))}
          </div>

          <div className="calendar-grid">
            {Array.from({ length: getFirstDayOfMonth(currentDate) }, (_, i) => (
              <div key={`empty-${i}`} className="calendar-empty"></div>
            ))}
            {Array.from({ length: getDaysInMonth(currentDate) }, (_, i) => {
              const day = i + 1;
              const count = getAttendanceCount(day);
              const targetDate = toDateString(new Date(currentDate.getFullYear(), currentDate.getMonth(), day));
              const isSelected = selectedDayData.length > 0 && selectedDayData[0]?.tanggal.toString().split('T')[0] === targetDate;
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
            {selectedDayData.length > 0 && (
              <button
                onClick={downloadDayExcel}
                title="Download Excel data hari ini"
                style={{
                  padding: '6px 12px',
                  background: '#22c55e',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '14px', height: '14px' }}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Excel
              </button>
            )}
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
                  </tr>
                </thead>
                <tbody>
                  {selectedDayData.map((att, i) => {
                    console.log(`Row ${i}:`, att);
                    return (
                      <tr key={att._id}>
                        <td>{i + 1}</td>
                        <td className="name-cell">{typeof att.userId === 'string' ? 'Unknown' : att.userId?.name || 'Unknown'}</td>
                        <td>{typeof att.userId === 'string' ? '-' : att.userId?.instansi || '-'}</td>
                        <td className="time-cell">{att.jamMasuk || '-'}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span className={`status-badge status-${isThresholdLoaded ? getStatusWithLate(att).toLowerCase() : (att.status || '').toLowerCase()}`}>{isThresholdLoaded ? getStatusWithLate(att) : att.status}</span>
                            <button
                              onClick={() => {
                                console.log('Button clicked for att:', att);
                                openEditStatus(att);
                              }}
                              className="edit-status-btn"
                              title="Edit status"
                              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 6, color: '#0a6599' }}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}>
                                <path d="M12 20h9" />
                                <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="summary-stats">
            <div className="stat-box">
              <div className="stat-label">Total Hadir</div>
              <div className="stat-value">
                {
                  selectedDayData.filter((a) => {
                    const s = (a.status || '').toLowerCase();
                    return s === 'hadir' || s === 'telat';
                  }).length
                }
              </div>
            </div>
            <div className="stat-box">
              <div className="stat-label">Total Izin</div>
              <div className="stat-value">{selectedDayData.filter((a) => (a.status || '').toLowerCase() === 'izin').length}</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">Total Alfa</div>
              <div className="stat-value">
                {
                  selectedDayData.filter((a) => {
                    const s = (a.status || '').toLowerCase();
                    return s === 'alpha' || s === 'alpa';
                  }).length
                }
              </div>
            </div>
          </div>
        </div>
      </div>
      {editingAtt && (
        <>
          {console.log('MODAL RENDERING - editingAtt:', editingAtt)}
          <div className="modal-overlay active" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div className="modal" style={{ background: 'white', borderRadius: 12, padding: 24, width: '100%', maxWidth: 400, boxShadow: '0 10px 40px rgba(0,0,0,0.3)' }}>
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ margin: 0, marginBottom: 4, fontSize: 18, fontWeight: 700, color: '#1e293b' }}>Edit Kehadiran</h3>
                <p style={{ margin: 0, fontSize: 14, color: '#64748b' }}>{typeof editingAtt.userId === 'string' ? 'Unknown' : editingAtt.userId?.name}</p>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Jam Masuk:</label>
                <input
                  type="time"
                  value={editJamMasuk}
                  onChange={(e) => setEditJamMasuk(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #cbd5e1',
                    borderRadius: 8,
                    fontSize: 14,
                    fontFamily: 'inherit',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Pilih Status:</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #cbd5e1',
                    borderRadius: 8,
                    fontSize: 14,
                    fontFamily: 'inherit',
                    boxSizing: 'border-box',
                    background: 'white',
                  }}
                >
                  <option value="Hadir">Hadir</option>
                  <option value="Telat">Telat</option>
                  <option value="Izin">Izin</option>
                  <option value="Alpha">Alpha</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={handleSaveStatus}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    background: '#22c55e',
                    color: 'white',
                    border: 'none',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontSize: 14,
                    fontWeight: 600,
                    transition: 'background 0.2s',
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.background = '#16a34a')}
                  onMouseOut={(e) => (e.currentTarget.style.background = '#22c55e')}
                >
                  Simpan
                </button>
                <button
                  onClick={closeEdit}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    background: '#e2e8f0',
                    border: 'none',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontSize: 14,
                    fontWeight: 600,
                    color: '#475569',
                    transition: 'background 0.2s',
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.background = '#cbd5e1')}
                  onMouseOut={(e) => (e.currentTarget.style.background = '#e2e8f0')}
                >
                  Batal
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default QRCodeAdmin;
