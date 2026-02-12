import React, { useEffect, useState, useCallback, useRef } from 'react';
import { exportRekapitulasiExcel } from '../../utils/excelExport';
import { useToast } from '../../context/ToastContext';
import { UsersAPI, WorkLogAPI } from '../../services/api';
import * as XLSX from 'xlsx';
import type { User } from '../../types';

interface RecapRow {
  userId: string;
  userName: string;
  jenis: string;
  berkas: number;
  buku: number;
  bundle: number;
}

interface PivotCell {
  berkas: number;
  buku: number;
  bundle: number;
  total: number;
}

interface PivotRow {
  userName: string;
  userId: string;
  cells: Record<string, PivotCell>;
  grandTotal: number;
}

const JENIS_LIST = [
  'Sortir',
  'Register',
  'Pencopotan Steples',
  'Scanning',
  'Rekardus',
  'Stikering',
];

const Rekapitulasi: React.FC = () => {
  const { showToast } = useToast();
  const [rawData, setRawData] = useState<RecapRow[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters
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

  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [showUserFilter, setShowUserFilter] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  // Load users list
  useEffect(() => {
    (async () => {
      const res = await UsersAPI.getAll();
      if (res && res.success) {
        const peserta = (res.data || []).filter((u: User) => u.role === 'user');
        setUsers(peserta);
      }
    })();
  }, []);

  // Close user filter dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setShowUserFilter(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Update dates when filter type changes or current month changes
  useEffect(() => {
    if (filterType === 'bulanan') {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const start = new Date(year, month, 1);
        const end = new Date(year, month + 1, 0);
        
        // Format to YYYY-MM-DD
        const startStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
        const endStr = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
        
        setDateFrom(startStr);
        setDateTo(endStr);
    }
  }, [filterType, currentDate]);

  const handlePrevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  const handleNextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));

  // Date Picker Logic
  const handleDatePickerPrevMonth = () => setDatePickerMonth(new Date(datePickerMonth.getFullYear(), datePickerMonth.getMonth() - 1));
  const handleDatePickerNextMonth = () => setDatePickerMonth(new Date(datePickerMonth.getFullYear(), datePickerMonth.getMonth() + 1));

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

    const monthName = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'][monthIndex];

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

  const fetchRecap = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.append('from', dateFrom);
      if (dateTo) params.append('to', dateTo);
      if (selectedUsers.length > 0) params.append('userIds', selectedUsers.join(','));

      const res = await WorkLogAPI.getRecap(params.toString());
      if (res && res.success) {
        setRawData(res.data || []);
      } else {
        showToast(res?.message || 'Gagal memuat data rekapitulasi', 'error');
      }
    } catch {
      showToast('Gagal memuat data rekapitulasi', 'error');
    }
    setLoading(false);
  }, [dateFrom, dateTo, selectedUsers, showToast]);

  useEffect(() => {
    fetchRecap();
  }, [fetchRecap]);

  // Build pivot table data
  const jenisList = JENIS_LIST;

  const pivotRows: PivotRow[] = (() => {
    const userMap: Record<string, PivotRow> = {};

    rawData.forEach((r) => {
      if (!userMap[r.userId]) {
        userMap[r.userId] = {
          userName: r.userName,
          userId: r.userId,
          cells: {},
          grandTotal: 0,
        };
        jenisList.forEach((j) => {
          userMap[r.userId].cells[j] = { berkas: 0, buku: 0, bundle: 0, total: 0 };
        });
      }
      const jKey = jenisList.find((j) => j.toLowerCase() === r.jenis.toLowerCase()) || r.jenis;
      if (!userMap[r.userId].cells[jKey]) {
        userMap[r.userId].cells[jKey] = { berkas: 0, buku: 0, bundle: 0, total: 0 };
      }
      userMap[r.userId].cells[jKey].berkas += r.berkas;
      userMap[r.userId].cells[jKey].buku += r.buku;
      userMap[r.userId].cells[jKey].bundle += r.bundle;
      userMap[r.userId].cells[jKey].total += r.berkas + r.buku + r.bundle;
    });

    // Calculate grand total
    Object.values(userMap).forEach((row) => {
      row.grandTotal = Object.values(row.cells).reduce((s, c) => s + c.total, 0);
    });

    return Object.values(userMap).sort((a, b) => a.userName.localeCompare(b.userName));
  })();

  // Totals row
  const totalsRow: Record<string, PivotCell> = {};
  jenisList.forEach((j) => {
    totalsRow[j] = { berkas: 0, buku: 0, bundle: 0, total: 0 };
  });
  let grandTotalAll = 0;
  pivotRows.forEach((row) => {
    jenisList.forEach((j) => {
      const c = row.cells[j] || { berkas: 0, buku: 0, bundle: 0, total: 0 };
      totalsRow[j].berkas += c.berkas;
      totalsRow[j].buku += c.buku;
      totalsRow[j].bundle += c.bundle;
      totalsRow[j].total += c.total;
    });
    grandTotalAll += row.grandTotal;
  });

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

  const exportToExcel = async () => {
    if (pivotRows.length === 0) {
      showToast('Tidak ada data untuk diekspor', 'error');
      return;
    }

    // Build header rows
    const headerRow1: string[] = ['TASK'];
    const headerRow2: string[] = ['NAMA PESERTA'];
    jenisList.forEach((j) => {
      headerRow1.push(j.toUpperCase(), '', '', '');
      headerRow2.push('BERKAS', 'BUKU', 'BUNDLE', 'TOTAL');
    });
    headerRow1.push('TOTAL');
    headerRow2.push('');

    // Build data rows
    const dataRows: (string | number)[][] = [];
    pivotRows.forEach((row) => {
      const r: (string | number)[] = [row.userName];
      jenisList.forEach((j) => {
        const c = row.cells[j] || { berkas: 0, buku: 0, bundle: 0, total: 0 };
        r.push(c.berkas, c.buku, c.bundle, c.total);
      });
      r.push(row.grandTotal);
      dataRows.push(r);
    });

    // TOTAL row
    const totalRow: (string | number)[] = ['TOTAL'];
    jenisList.forEach((j) => {
      totalRow.push(totalsRow[j].berkas, totalsRow[j].buku, totalsRow[j].bundle, totalsRow[j].total);
    });
    totalRow.push(grandTotalAll);
    dataRows.push(totalRow);

    const wsData = [headerRow1, headerRow2, ...dataRows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Merge cells for header row 1 (jenis groups)
    const merges: XLSX.Range[] = [];
    let col = 1;
    jenisList.forEach(() => {
      merges.push({ s: { r: 0, c: col }, e: { r: 0, c: col + 3 } });
      col += 4;
    });
    // Merge TASK cell (0,0) vertically with NAMA PESERTA
    // Merge TOTAL header
    merges.push({ s: { r: 0, c: col }, e: { r: 1, c: col } });
    ws['!merges'] = merges;

    // Auto-size columns
    const colWidths = wsData[0].map((_, i) => ({
      wch: Math.max(
        ...wsData.map((r) => String(r[i] ?? '').length),
        8
      ) + 2,
    }));
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rekapitulasi');

    let filename = '';
    if (filterType === 'bulanan') {
        const monthName = currentDate.toLocaleDateString('id-ID', { month: 'long' });
        const year = currentDate.getFullYear();
        filename = `Rekapitulasi_Pekerjaan_${monthName}_${year}.xlsx`;
    } else if (filterType === 'custom' && dateFrom && dateTo) {
        filename = `Rekapitulasi_Pekerjaan_${dateFrom}_sd_${dateTo}.xlsx`;
    } else {
        const dateStr = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
        filename = `Rekapitulasi_Pekerjaan_${dateStr}.xlsx`;
    }
    XLSX.writeFile(wb, filename);
    showToast('Berhasil mengekspor data ke Excel', 'success');
  };

  const formatDateLabel = () => {
    if (dateFrom && dateTo) {
      const f = new Date(dateFrom).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
      const t = new Date(dateTo).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
      return `${f} — ${t}`;
    }
    if (dateFrom) return `Dari ${new Date(dateFrom).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    if (dateTo) return `Sampai ${new Date(dateTo).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    return 'Semua Tanggal';
  };

  return (
    <div>
      <div className="page-header-row">
        <div className="page-header">
          <h1>Rekapitulasi Pekerjaan</h1>
          <p>Rekap data pekerjaan seluruh peserta magang berdasarkan jenis pekerjaan</p>
        </div>
      </div>

      {/* Filters */}
      {/* Filters */}
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
                    if(!isSelectingDateRange) setIsSelectingStart(true);
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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export Excel
          </button>
        </div>
      </div>

      {/* Info bar */}
      <div className="rekap-info-bar">
        <span className="rekap-info-badge">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
          {formatDateLabel()}
        </span>
        <span className="rekap-info-badge">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>
          {pivotRows.length} Peserta
        </span>
        <span className="rekap-info-badge">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
          Total: {grandTotalAll.toLocaleString('id-ID')}
        </span>
      </div>

      {/* Table */}
      <div className="rekap-table-card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--gray-400)' }}>
            <div style={{ width: 36, height: 36, border: '3px solid var(--gray-200)', borderTop: '3px solid var(--primary-500)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
            Memuat data...
          </div>
        ) : (
          <div className="rekap-table-wrapper">
            <table className="rekap-table">
              <thead>
                <tr>
                  <th rowSpan={2} className="rekap-th-sticky">NAMA PESERTA</th>
                  {jenisList.map((j) => (
                    <th key={j} colSpan={4} className="rekap-th-group">{j.toUpperCase()}</th>
                  ))}
                  <th rowSpan={2} className="rekap-th-total">TOTAL</th>
                </tr>
                <tr>
                  {jenisList.map((j) => (
                    <React.Fragment key={j + '-sub'}>
                      <th className="rekap-th-sub">BERKAS</th>
                      <th className="rekap-th-sub">BUKU</th>
                      <th className="rekap-th-sub">BUNDLE</th>
                      <th className="rekap-th-sub rekap-th-sub-total">TOTAL</th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pivotRows.length === 0 ? (
                  <tr>
                    <td colSpan={jenisList.length * 4 + 2} style={{ textAlign: 'center', padding: 40, color: 'var(--gray-400)' }}>
                      Belum ada data rekapitulasi
                    </td>
                  </tr>
                ) : (
                  <>
                    {pivotRows.map((row) => (
                      <tr key={row.userId}>
                        <td className="rekap-td-name">{row.userName}</td>
                        {jenisList.map((j) => {
                          const c = row.cells[j] || { berkas: 0, buku: 0, bundle: 0, total: 0 };
                          return (
                            <React.Fragment key={j}>
                              <td className="rekap-td-num">{c.berkas}</td>
                              <td className="rekap-td-num">{c.buku}</td>
                              <td className="rekap-td-num">{c.bundle}</td>
                              <td className="rekap-td-num rekap-td-subtotal">{c.total}</td>
                            </React.Fragment>
                          );
                        })}
                        <td className="rekap-td-num rekap-td-grandtotal">{row.grandTotal}</td>
                      </tr>
                    ))}
                    <tr className="rekap-total-row">
                      <td className="rekap-td-name" style={{ fontWeight: 800 }}>TOTAL</td>
                      {jenisList.map((j) => (
                        <React.Fragment key={j + '-tot'}>
                          <td className="rekap-td-num">{totalsRow[j].berkas}</td>
                          <td className="rekap-td-num">{totalsRow[j].buku}</td>
                          <td className="rekap-td-num">{totalsRow[j].bundle}</td>
                          <td className="rekap-td-num rekap-td-subtotal">{totalsRow[j].total}</td>
                        </React.Fragment>
                      ))}
                      <td className="rekap-td-num rekap-td-grandtotal">{grandTotalAll}</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Rekapitulasi;
