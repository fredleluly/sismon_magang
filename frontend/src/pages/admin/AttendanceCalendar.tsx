import React, { useState, useEffect } from 'react';
import { AttendanceAPI, UsersAPI, getToken } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import type { Attendance } from '../../types';
import * as XLSX from 'xlsx';
import './AttendanceCalendar.css';

type FilterMode = 'harian' | 'mingguan' | 'bulanan' | 'custom';

const AttendanceCalendar: React.FC = () => {
  const { showToast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [attendanceData, setAttendanceData] = useState<Attendance[]>([]);
  const [selectedDayData, setSelectedDayData] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);
  const [viewingPhotoName, setViewingPhotoName] = useState<string>('');
  const [editingAtt, setEditingAtt] = useState<any | null>(null);
  const [editStatus, setEditStatus] = useState<string>('Hadir');
  const [editJamMasuk, setEditJamMasuk] = useState<string>('');

  // Filter states
  const [filterMode, setFilterMode] = useState<FilterMode>('harian');
  const [filterData, setFilterData] = useState<Attendance[]>([]);
  const [filterLabel, setFilterLabel] = useState<string>('');
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');
  const [filterLoading, setFilterLoading] = useState(false);

  // Status & threshold states (moved from QRCodeAdmin)
  const [totalPeserta, setTotalPeserta] = useState(0);
  const [todayAttendanceCount, setTodayAttendanceCount] = useState(0);
  const [lateThreshold, setLateThreshold] = useState<string>('08:00');
  const [isEditingThreshold, setIsEditingThreshold] = useState(false);
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

  const toDateStr = (d: Date): string => {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  // Load today's attendance count and total peserta
  const loadTodayStats = async () => {
    try {
      const res = await fetch('/api/attendance/today', { headers: { Authorization: 'Bearer ' + getToken() } });
      const d = await res.json();
      if (d.success) setTodayAttendanceCount((d.data || []).length);
    } catch {}
    try {
      const users = await UsersAPI.getAll();
      if (users && users.success) setTotalPeserta(users.data.length);
    } catch {}
  };

  const handleSaveThreshold = async () => {
    const res = await AttendanceAPI.setLateThreshold(lateThreshold);
    if (res && res.success) {
      localStorage.setItem('lateThreshold', lateThreshold);
      showToast('Jam telat berhasil diatur ke ' + lateThreshold, 'success');
      setIsEditingThreshold(false);
    } else {
      showToast(res?.message || 'Gagal menyimpan', 'error');
    }
  };

  // Load late threshold
  useEffect(() => {
    const loadThreshold = async () => {
      const res = await AttendanceAPI.getLateThreshold();
      if (res && res.success) {
        setLateThreshold(res.data.lateThreshold);
        localStorage.setItem('lateThreshold', res.data.lateThreshold);
      } else {
        const saved = localStorage.getItem('lateThreshold');
        if (saved) setLateThreshold(saved);
      }
      setIsThresholdLoaded(true);
    };
    loadThreshold();
    loadTodayStats();
    const iv = setInterval(loadTodayStats, 30000);
    return () => clearInterval(iv);
  }, []);


  const handleViewPhoto = async (attendanceId: string, userName: string) => {
    try {
      showToast('Memuat foto...', 'info');
      const res = await AttendanceAPI.getPhoto(attendanceId);
      if (res && res.success && res.data.foto) {
        setViewingPhoto(res.data.foto);
        setViewingPhotoName(userName);
      } else {
        showToast('Foto tidak tersedia', 'error');
      }
    } catch (error) {
      showToast('Gagal memuat foto', 'error');
    }
  };

  const openEditStatus = (att: any) => {
    setEditingAtt(att);
    setEditStatus(att.status || 'Hadir');
    const jam = att.jamMasuk ? att.jamMasuk.replace('.', ':') : '00:00';
    setEditJamMasuk(jam);
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
        const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59);
        const from = toDateStr(startOfMonth);
        const to = toDateStr(endOfMonth);
        const attRes = await AttendanceAPI.getAll(`from=${from}&to=${to}&limit=1000`);
        if (attRes && attRes.success) {
          const newData = attRes.data || [];
          setAttendanceData(newData);
          if (selectedDayData.length > 0) {
            const selectedDate = selectedDayData[0]?.tanggal.toString().split('T')[0];
            setSelectedDayData(newData.filter((a: any) => a.tanggal.toString().split('T')[0] === selectedDate));
          }
          // Also refresh filter data if active
          if (filterData.length > 0) {
            applyFilterOnData(newData);
          }
        }
      } else {
        showToast(res?.message || 'Gagal memperbarui data', 'error');
      }
    } catch (err) {
      showToast('Gagal memperbarui data', 'error');
    }
  };

  const loadAttendanceData = async () => {
    setLoading(true);
    try {
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59);
      const from = toDateStr(startOfMonth);
      const to = toDateStr(endOfMonth);
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


  const getAttendanceForDay = (day: number): Attendance[] => {
    const targetDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const dateStr = toDateStr(targetDate);
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
    // When clicking a day, switch filter mode to harian and show that day
    setFilterMode('harian');
    setFilterData(dayData);
    const targetDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    setFilterLabel(targetDate.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
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

  // Filter helpers
  const applyFilterOnData = (data: Attendance[]) => {
    const now = new Date();
    if (filterMode === 'mingguan') {
      const dayOfWeek = now.getDay();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - dayOfWeek);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      const fromStr = toDateStr(startOfWeek);
      const toStr = toDateStr(endOfWeek);
      setFilterData(data.filter((a) => {
        const d = a.tanggal.toString().split('T')[0];
        return d >= fromStr && d <= toStr;
      }));
    } else if (filterMode === 'bulanan') {
      setFilterData(data);
    } else if (filterMode === 'custom' && customFrom && customTo) {
      setFilterData(data.filter((a) => {
        const d = a.tanggal.toString().split('T')[0];
        return d >= customFrom && d <= customTo;
      }));
    }
  };

  const handleApplyFilter = async () => {
    if (filterMode === 'harian') {
      // Harian uses the calendar day click
      return;
    }

    setFilterLoading(true);
    try {
      let from = '';
      let to = '';
      const now = new Date();

      if (filterMode === 'mingguan') {
        const dayOfWeek = now.getDay();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - dayOfWeek);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        from = toDateStr(startOfWeek);
        to = toDateStr(endOfWeek);
        setFilterLabel(`${startOfWeek.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} - ${endOfWeek.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`);
      } else if (filterMode === 'bulanan') {
        const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        from = toDateStr(startOfMonth);
        to = toDateStr(endOfMonth);
        setFilterLabel(`${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`);
      } else if (filterMode === 'custom') {
        if (!customFrom || !customTo) {
          showToast('Pilih tanggal awal dan akhir', 'error');
          setFilterLoading(false);
          return;
        }
        from = customFrom;
        to = customTo;
        const fromDate = new Date(customFrom + 'T00:00:00');
        const toDate = new Date(customTo + 'T00:00:00');
        setFilterLabel(`${fromDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })} - ${toDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`);
      }

      const res = await AttendanceAPI.getAll(`from=${from}&to=${to}&limit=5000`);
      if (res && res.success) {
        setFilterData(res.data || []);
        setSelectedDayData([]);
      } else {
        showToast('Gagal memuat data', 'error');
      }
    } catch (error) {
      showToast('Error memuat data', 'error');
    } finally {
      setFilterLoading(false);
    }
  };

  const handleExportExcel = () => {
    const dataToExport = filterData.length > 0 ? filterData : selectedDayData;
    if (dataToExport.length === 0) {
      showToast('Tidak ada data untuk diexport', 'error');
      return;
    }

    try {
      const wsData: any[] = [
        ['DATA KEHADIRAN'],
        [`Filter: ${filterLabel || 'Semua'}`],
        [`Total Data: ${dataToExport.length}`],
        [],
        ['No', 'Nama', 'Institusi', 'Tanggal', 'Jam Masuk', 'Status'],
      ];

      dataToExport.forEach((att, index) => {
        const name = typeof att.userId === 'string' ? 'Unknown' : att.userId?.name || 'Unknown';
        const instansi = typeof att.userId === 'string' ? '-' : att.userId?.instansi || '-';
        const tanggal = new Date(att.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
        wsData.push([index + 1, name, instansi, tanggal, att.jamMasuk || '-', att.status]);
      });

      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Kehadiran');
      ws['!cols'] = [{ wch: 5 }, { wch: 22 }, { wch: 22 }, { wch: 20 }, { wch: 12 }, { wch: 12 }];

      let filename = 'Kehadiran';
      if (filterMode === 'mingguan') filename = 'Kehadiran_Mingguan';
      else if (filterMode === 'bulanan') filename = `Kehadiran_${monthNames[currentDate.getMonth()]}_${currentDate.getFullYear()}`;
      else if (filterMode === 'custom') filename = `Kehadiran_${customFrom}_sd_${customTo}`;
      else if (filterMode === 'harian' && selectedDayData.length > 0) {
        filename = `Kehadiran_${selectedDayData[0]?.tanggal.toString().split('T')[0]}`;
      }

      XLSX.writeFile(wb, `${filename}.xlsx`);
      showToast('Excel berhasil diunduh!', 'success');
    } catch (error) {
      showToast('Gagal mengunduh Excel', 'error');
    }
  };

  // Data to display in detail table - use filterData when filter is non-harian, selectedDayData for harian
  const displayData = filterMode === 'harian' ? selectedDayData : filterData;

  return (
    <div className="attendance-calendar-container">
      <div className="page-header">
        <h1>Data Absensi</h1>
        <p>Kelola dan lihat data kehadiran peserta magang</p>
      </div>

      {/* Status Absen & Pengaturan Jam Telat */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div className="qr-status-card" style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid rgba(226,232,240,0.6)', boxShadow: '0 4px 24px rgba(10,101,153,0.1)' }}>
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', margin: 0 }}>Status Absen Hari Ini</h3>
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 1, background: '#f0f9ff', borderRadius: 10, padding: '16px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#0a6599' }}>{totalPeserta}</div>
              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 500, marginTop: 4 }}>Total Peserta</div>
            </div>
            <div style={{ flex: 1, background: '#f0fdf4', borderRadius: 10, padding: '16px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#22c55e' }}>{todayAttendanceCount}</div>
              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 500, marginTop: 4 }}>Sudah Absen</div>
            </div>
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid rgba(226,232,240,0.6)', boxShadow: '0 4px 24px rgba(10,101,153,0.1)' }}>
          <div style={{ marginBottom: 12 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', margin: 0 }}>Pengaturan Jam Telat</h3>
          </div>
          {!isEditingThreshold ? (
            <div>
              <div style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }}>Jam Batas Telat:</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#0a6599' }}>{lateThreshold}</div>
                <button onClick={() => setIsEditingThreshold(true)} style={{ padding: '6px 14px', background: '#e2e8f0', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                  Edit
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>
                Masukkan Jam Batas Telat (format HH:MM):
                <input
                  type="time"
                  value={lateThreshold}
                  onChange={(e) => setLateThreshold(e.target.value)}
                  style={{ marginTop: 6, padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 14, width: '100%', fontFamily: 'inherit' }}
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

          {/* Filter Controls */}
          <div style={{ background: '#f8fafc', borderRadius: 10, padding: 16, marginBottom: 16, border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>Filter:</span>
              {(['harian', 'mingguan', 'bulanan', 'custom'] as FilterMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => {
                    setFilterMode(mode);
                    if (mode === 'harian') {
                      setFilterData([]);
                      setFilterLabel('');
                    }
                  }}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 6,
                    border: filterMode === mode ? '2px solid #0a6599' : '1px solid #cbd5e1',
                    background: filterMode === mode ? '#e6f4fa' : 'white',
                    color: filterMode === mode ? '#0a6599' : '#64748b',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                  }}
                >
                  {mode}
                </button>
              ))}
            </div>

            {filterMode === 'custom' && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Dari:</label>
                  <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} style={{ padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13, fontFamily: 'inherit' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Sampai:</label>
                  <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} style={{ padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13, fontFamily: 'inherit' }} />
                </div>
              </div>
            )}

            {filterMode !== 'harian' && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  onClick={handleApplyFilter}
                  disabled={filterLoading}
                  style={{
                    padding: '7px 18px',
                    background: '#0a6599',
                    color: 'white',
                    border: 'none',
                    borderRadius: 6,
                    cursor: filterLoading ? 'not-allowed' : 'pointer',
                    fontSize: 12,
                    fontWeight: 600,
                    opacity: filterLoading ? 0.7 : 1,
                  }}
                >
                  {filterLoading ? 'Memuat...' : 'Terapkan Filter'}
                </button>
                {filterLabel && <span style={{ fontSize: 12, color: '#64748b', fontStyle: 'italic' }}>{filterLabel}</span>}
              </div>
            )}

            {filterMode === 'harian' && (
              <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>Klik tanggal pada kalender untuk melihat data harian</p>
            )}
          </div>

          {/* Export Button */}
          {displayData.length > 0 && (
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={handleExportExcel}
                style={{
                  padding: '8px 16px',
                  background: '#22c55e',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Export Excel ({displayData.length} data)
              </button>
            </div>
          )}

          {displayData.length === 0 ? (
            <div className="no-selection">
              <p>{filterMode === 'harian' ? 'Pilih tanggal untuk melihat detail kehadiran' : 'Klik "Terapkan Filter" untuk memuat data'}</p>
            </div>
          ) : (
            <div className="details-content">
              <div className="day-info">
                <h4>{filterLabel || 'Data Kehadiran'}</h4>
                <p>{displayData.length} data kehadiran</p>
              </div>

              <table className="attendance-table">
                <thead>
                  <tr>
                    <th>No</th>
                    <th>Nama</th>
                    <th>Institusi</th>
                    {filterMode !== 'harian' && <th>Tanggal</th>}
                    <th>Jam Masuk</th>
                    <th>Status</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {displayData.map((att, i) => (
                    <tr key={att._id}>
                      <td>{i + 1}</td>
                      <td className="name-cell">{typeof att.userId === 'string' ? 'Unknown' : att.userId?.name || 'Unknown'}</td>
                      <td>{typeof att.userId === 'string' ? '-' : att.userId?.instansi || '-'}</td>
                      {filterMode !== 'harian' && (
                        <td style={{ fontSize: 12 }}>{new Date(att.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                      )}
                      <td className="time-cell">{att.jamMasuk || '-'}</td>
                      <td>
                        <span className={`status-badge status-${(isThresholdLoaded ? getStatusWithLate(att) : att.status || '').toLowerCase().replace(/\s+/g, '-')}`}>{isThresholdLoaded ? getStatusWithLate(att) : att.status}</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {att.fotoAbsensi ? (
                            <button
                              onClick={() => handleViewPhoto(att._id, typeof att.userId === 'string' ? 'User' : att.userId?.name || 'User')}
                              title="Lihat Foto"
                              style={{ background: 'none', border: '1px solid var(--gray-300)', borderRadius: 4, padding: 4, cursor: 'pointer', color: 'var(--primary-600)' }}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                <circle cx="12" cy="12" r="3"></circle>
                              </svg>
                            </button>
                          ) : (
                            <span style={{ width: 26 }}></span>
                          )}
                          <button
                            onClick={() => openEditStatus(att)}
                            title="Edit Status"
                            style={{ background: 'none', border: '1px solid var(--gray-300)', borderRadius: 4, padding: 4, cursor: 'pointer', color: '#f59e0b' }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 20h9"></path>
                              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path>
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="summary-stats">
            <div className="stat-box">
              <div className="stat-label">Total Hadir</div>
              <div className="stat-value">
                {displayData.filter((a) => {
                  const s = (a.status || '').toLowerCase();
                  return s === 'hadir' || s === 'telat';
                }).length}
              </div>
            </div>
            <div className="stat-box">
              <div className="stat-label">Total Izin</div>
              <div className="stat-value">{displayData.filter((a) => (a.status || '').toLowerCase() === 'izin').length}</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">Total Alpa</div>
              <div className="stat-value">
                {displayData.filter((a) => {
                  const s = (a.status || '').toLowerCase();
                  return s === 'alpha' || s === 'alpa';
                }).length}
              </div>
            </div>
          </div>
        </div>
      </div>

      {editingAtt && (
        <div
          className="modal-overlay active"
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={closeEdit}
        >
          <div
            style={{ background: 'white', borderRadius: 12, padding: 24, width: '100%', maxWidth: 400, boxShadow: '0 10px 40px rgba(0,0,0,0.3)' }}
            onClick={(e) => e.stopPropagation()}
          >
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
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Pilih Status:</label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box', background: 'white' }}
              >
                <option value="Hadir">Hadir</option>
                <option value="Telat">Telat</option>
                <option value="Izin">Izin</option>
                <option value="Alpha">Alpa</option>
                <option value="Hari Libur">Hari Libur</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={handleSaveStatus}
                style={{ flex: 1, padding: '10px 14px', background: '#22c55e', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}
              >
                Simpan
              </button>
              <button
                onClick={closeEdit}
                style={{ flex: 1, padding: '10px 14px', background: '#e2e8f0', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#475569' }}
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {viewingPhoto && (
        <div
          className="modal-overlay active"
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => { setViewingPhoto(null); setViewingPhotoName(''); }}
        >
          <div
            style={{ background: 'white', borderRadius: 12, padding: 20, maxWidth: 500, width: '90%', boxShadow: '0 10px 40px rgba(0,0,0,0.3)', position: 'relative' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e293b' }}>Foto Absensi - {viewingPhotoName}</h3>
              <button
                onClick={() => { setViewingPhoto(null); setViewingPhotoName(''); }}
                style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: '#64748b' }}
              >
                ✕
              </button>
            </div>
            <img
              src={viewingPhoto}
              alt={`Foto absensi ${viewingPhotoName}`}
              style={{ width: '100%', borderRadius: 8, maxHeight: '60vh', objectFit: 'contain' }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceCalendar;
