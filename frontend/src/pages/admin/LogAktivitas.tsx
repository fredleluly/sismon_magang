import React, { useEffect, useState, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import { WorkLogAPI, UsersAPI } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import type { WorkLog, User } from '../../types';

const LogAktivitas: React.FC = () => {
  const { showToast } = useToast();
  const [logs, setLogs] = useState<WorkLog[]>([]);
  const [search, setSearch] = useState('');
  
  // Filter State
  const [filterType, setFilterType] = useState<'bulanan' | 'custom'>('bulanan');
  const [currentDate, setCurrentDate] = useState(new Date()); // For monthly view
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Custom Date Picker State
  const [isSelectingDateRange, setIsSelectingDateRange] = useState(false);
  const [datePickerMonth, setDatePickerMonth] = useState(new Date());
  const [tempDateRangeStart, setTempDateRangeStart] = useState<string>('');
  const [tempDateRangeEnd, setTempDateRangeEnd] = useState<string>('');
  const [isSelectingStart, setIsSelectingStart] = useState(true);

  // User Filter State
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [showUserFilter, setShowUserFilter] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  // Load users for filter
  useEffect(() => {
    const loadUsers = async () => {
        const res = await UsersAPI.getAll();
        if (res && res.success) {
            setUsers(res.data.filter((u: User) => u.role !== 'admin'));
        }
    };
    loadUsers();

    // Click outside to close dropdowns
    const handleClickOutside = (event: MouseEvent) => {
        if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
            setShowUserFilter(false);
        }
        const target = event.target as HTMLElement;
        if (!target.closest('.custom-date-picker-dropdown') && !target.closest('.custom-date-range-toggle')) {
            setIsSelectingDateRange(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const load = useCallback(async () => {
    try {
        let query = 'status=Selesai';
        
        // Add date filter
        if (filterType === 'bulanan') {
            const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
            const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
            query += `&from=${start.toISOString().split('T')[0]}&to=${end.toISOString().split('T')[0]}`;
        } else if (filterType === 'custom' && dateFrom && dateTo) {
            query += `&from=${dateFrom}&to=${dateTo}`;
        }

        // Add user filter
        if (selectedUsers.length > 0) {
            query += `&userIds=${selectedUsers.join(',')}`;
        }

        const res = await WorkLogAPI.getAll(query);
        if (res && res.success) setLogs(res.data || []);
        else {
             // If error or no data, default to empty but don't show error toast on initial empty state if just no data found
             setLogs([]); 
             // showToast('Gagal memuat data', 'error'); // Optional: suppress to avoid noise
        }
    } catch (err) {
        showToast('Gagal memuat data', 'error');
    }
  }, [filterType, currentDate, dateFrom, dateTo, selectedUsers]);

  useEffect(() => { load(); }, [load]);
  
  const toggleUser = (id: string) => {
    setSelectedUsers((prev) => (prev.includes(id) ? prev.filter((u) => u !== id) : [...prev, id]));
  };

  const selectAllUsers = () => {
    if (selectedUsers.length === users.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(users.map((u) => u._id));
    }
  };

  // --- Date Picker Logic ---
  const handlePrevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  const handleNextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  
  const handleDatePickerPrevMonth = () => setDatePickerMonth(new Date(datePickerMonth.getFullYear(), datePickerMonth.getMonth() - 1));
  const handleDatePickerNextMonth = () => setDatePickerMonth(new Date(datePickerMonth.getFullYear(), datePickerMonth.getMonth() + 1));

  const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  const handleCalendarDateClick = (year: number, month: number, day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (isSelectingStart) {
      setTempDateRangeStart(dateStr);
      setTempDateRangeEnd('');
      setIsSelectingStart(false);
    } else {
      if (new Date(dateStr) >= new Date(tempDateRangeStart)) {
        setTempDateRangeEnd(dateStr);
      } else {
        showToast('Pilih tanggal akhir yang lebih besar dari tanggal awal', 'error');
      }
    }
  };

  const isDateInRange = (year: number, month: number, day: number): boolean => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (!tempDateRangeStart) return false;
    if (!tempDateRangeEnd) return dateStr >= tempDateRangeStart;
    return dateStr >= tempDateRangeStart && dateStr <= tempDateRangeEnd;
  };

  const isDateStartEnd = (year: number, month: number, day: number): 'start' | 'end' | null => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (dateStr === tempDateRangeStart) return 'start';
    if (dateStr === tempDateRangeEnd) return 'end';
    return null;
  };

  const renderCalendarMonth = (offset: number) => {
    const month = new Date(datePickerMonth.getFullYear(), datePickerMonth.getMonth() + offset);
    const year = month.getFullYear();
    const monthIndex = month.getMonth();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const firstDay = new Date(year, monthIndex, 1).getDay();
    const monthName = monthNames[monthIndex];

    const days = [];
    for (let i = 0; i < firstDay; i++) {
        days.push(<div key={`empty-${i}`} className="calendar-cell empty"></div>);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const inRange = isDateInRange(year, monthIndex, day);
        const startEnd = isDateStartEnd(year, monthIndex, day);
        const isStart = startEnd === 'start';
        const isEnd = startEnd === 'end';

        days.push(
            <div
                key={day}
                className={`calendar-cell ${inRange ? 'in-range' : ''} ${isStart ? 'start-date' : ''} ${isEnd ? 'end-date' : ''}`}
                onClick={() => handleCalendarDateClick(year, monthIndex, day)}
            >
                {day}
            </div>
        );
    }

    return (
        <div className="calendar-month-picker">
            <div className="calendar-month-header">
                <h3>{monthName} {year}</h3>
            </div>
            <div className="calendar-weekdays">
                {['S','M','T','W','T','F','S'].map(d => <div key={d} className="calendar-weekday">{d}</div>)}
            </div>
            <div className="calendar-days">{days}</div>
        </div>
    );
  };
  // -------------------------

  const filtered = logs.filter(l => {
    const q = search.toLowerCase();
    return (l.userId as any)?.name?.toLowerCase().includes(q) || (l.jenis||'').toLowerCase().includes(q) || (l.keterangan||'').toLowerCase().includes(q);
  });

  const avColors = ['av-a','av-b','av-c','av-d','av-e'];

  const exportToExcel = async () => {
    if (filtered.length === 0) {
      showToast('Tidak ada data untuk diekspor', 'error');
      return;
    }
    const data = filtered.map((l, i) => ({
      'No': i + 1,
      'Nama Peserta': (l.userId as any)?.name || 'Unknown',
      'Tanggal': l.tanggal ? new Date(l.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-',
      'Jenis Pekerjaan': l.jenis || '-',
      'Keterangan': l.keterangan || '-',
      'Berkas': l.berkas || 0,
      'Buku': l.buku || 0,
      'Bundle': l.bundle || 0,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    // Auto-size columns
    const colWidths = Object.keys(data[0]).map(key => ({
      wch: Math.max(key.length, ...data.map(row => String((row as any)[key]).length)) + 2,
    }));
    ws['!cols'] = colWidths;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Log Aktivitas');
    const today = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
    XLSX.writeFile(wb, `Log_Aktivitas_${today}.xlsx`);
    showToast('Berhasil mengekspor data ke Excel', 'success');
  };

  return (
    <>
      <div className="page-header-row"><div className="page-header"><h1>Log Aktivitas</h1><p>Pantau aktivitas pekerjaan seluruh peserta magang</p></div></div>
      
      {/* Filters (Rekapitulasi Style) */}
      <div className="work-filter-bar">
        <div className="work-filter-left">
            <button 
                className={`filter-btn ${filterType === 'bulanan' ? 'active' : ''}`} 
                onClick={() => setFilterType('bulanan')}
            >
                Bulanan
            </button>
            <button 
                className={`filter-btn ${filterType === 'custom' ? 'active' : ''}`} 
                onClick={() => {
                  setFilterType('custom');
                  if (!isSelectingDateRange) setIsSelectingStart(true);
                }}
            >
                Custom
            </button>

            {filterType === 'bulanan' ? (
                <div className="month-picker-container">
                    <button onClick={handlePrevMonth} style={{ background: 'none', color: 'var(--gray-500)', padding: 4 }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                    </button>
                    <span className="month-display">
                        {currentDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                    </span>
                    <button onClick={handleNextMonth} style={{ background: 'none', color: 'var(--gray-500)', padding: 4 }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </button>
                </div>
            ) : (
                <div className="custom-date-range-container">
                    <button 
                      className="custom-date-range-toggle" 
                      onClick={() => setIsSelectingDateRange(!isSelectingDateRange)}
                    >
                      {dateFrom && dateTo 
                        ? `${dateFrom} - ${dateTo}` 
                        : 'Pilih Rentang Tanggal'}
                      <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="2" 
                        style={{ 
                          width: '16px', 
                          height: '16px', 
                          transform: isSelectingDateRange ? 'rotate(180deg)' : 'rotate(0deg)',
                          transition: 'transform 0.2s',
                        }}
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>

                    {isSelectingDateRange && (
                      <div className="custom-date-picker-dropdown">
                        <div className="custom-date-picker-header">
                          <button className="custom-date-nav-btn" onClick={handleDatePickerPrevMonth}>←</button>
                          <span>Pilih Rentang Tanggal</span>
                          <button className="custom-date-nav-btn" onClick={handleDatePickerNextMonth}>→</button>
                        </div>
                        
                        <div className="custom-calendars-container">
                          {renderCalendarMonth(0)}
                          {renderCalendarMonth(1)}
                        </div>

                        <div className="custom-date-range-info">
                          {tempDateRangeStart && !tempDateRangeEnd && <p>Pilih tanggal akhir</p>}
                          {tempDateRangeStart && tempDateRangeEnd && (
                            <p>{tempDateRangeStart} sampai {tempDateRangeEnd}</p>
                          )}
                        </div>

                        <div className="custom-date-picker-footer">
                            <button 
                                className="custom-date-apply-btn"
                                onClick={() => {
                                    if (tempDateRangeStart && tempDateRangeEnd) {
                                        setDateFrom(tempDateRangeStart);
                                        setDateTo(tempDateRangeEnd);
                                        setIsSelectingDateRange(false);
                                        setIsSelectingStart(true);
                                    } else {
                                        showToast('Pilih tanggal awal dan akhir terlebih dahulu', 'error');
                                    }
                                }}
                            >
                                Terapkan
                            </button>
                            <button 
                                className="custom-date-cancel-btn"
                                onClick={() => {
                                    setIsSelectingDateRange(false);
                                    setTempDateRangeStart('');
                                    setTempDateRangeEnd('');
                                    setIsSelectingStart(true);
                                }}
                            >
                                Batal
                            </button>
                        </div>
                      </div>
                    )}
                </div>
            )}

            {/* User Filter Dropdown */}
            <div className="rekap-filter-group rekap-user-filter rekap-user-filter-container" ref={filterRef}>
              <button
                className="rekap-user-btn"
                onClick={() => setShowUserFilter(!showUserFilter)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                </svg>
                {selectedUsers.length === 0
                  ? 'Semua Peserta'
                  : selectedUsers.length === users.length
                    ? 'Semua Peserta'
                    : `${selectedUsers.length} Peserta`}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="rekap-user-btn-icon-right">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {showUserFilter && (
                <div className="rekap-user-dropdown">
                  <div className="rekap-user-option" onClick={selectAllUsers}>
                    <input type="checkbox" checked={selectedUsers.length === users.length && users.length > 0} readOnly />
                    <span style={{ fontWeight: 600 }}>Pilih Semua</span>
                  </div>
                  <div className="rekap-user-dropdown-divider" />
                  {users.map((u) => (
                    <div key={u._id} className="rekap-user-option" onClick={() => toggleUser(u._id)}>
                      <input type="checkbox" checked={selectedUsers.includes(u._id)} readOnly />
                      <span>{u.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
        </div>

        <div className="rekap-filter-actions">
            <button className="btn-export" onClick={exportToExcel}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Export Excel
            </button>
        </div>
      </div>
     
      {/* Search Bar */}
      <div className="log-table-card">
        <div className="peserta-table-header">
          <div className="pth-left"><h3>Aktivitas Terbaru</h3></div>
          <div className="peserta-search"><input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari aktivitas..." /></div>
        </div>
        <div className="table-container">
          <table className="log-table">
            <thead>
              <tr>
                <th>Nama Peserta</th>
                <th>Tanggal</th>
                <th>Jenis Pekerjaan</th>
                <th>Keterangan</th>
                <th>Berkas</th>
                <th>Buku</th>
                <th>Bundle</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--gray-400)' }}>
                    Belum ada data
                  </td>
                </tr>
              ) : (
                filtered.map((l, i) => {
                  const name = (l.userId as any)?.name || 'Unknown';
                  const dateStr = l.tanggal ? new Date(l.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
                  return (
                    <tr key={l._id}>
                      <td>
                        <div className="user-cell">
                          <span className="user-name">{name}</span>
                        </div>
                      </td>
                      <td>{dateStr}</td>
                      <td>
                        <span className="job-badge">{l.jenis || '-'}</span>
                      </td>
                      <td style={{ maxWidth: 300, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={l.keterangan || '-'}>{l.keterangan || '-'}</td>
                      <td>
                        <span className="data-highlight">{l.berkas || 0}</span>
                      </td>
                      <td>
                        <span className="data-highlight">{l.buku || 0}</span>
                      </td>
                      <td>
                        <span className="data-highlight">{l.bundle || 0}</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

export default LogAktivitas;
