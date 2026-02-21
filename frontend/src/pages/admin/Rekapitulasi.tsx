import React, { useEffect, useState, useCallback, useRef } from 'react';
import { exportRekapitulasiExcel } from '../../utils/excelExport';
import { useToast } from '../../context/ToastContext';
import { UsersAPI, WorkLogAPI, TargetSectionAPI } from '../../services/api';
import type { User, TargetSection } from '../../types';

const formatRupiah = (value: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

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

  // Target & Upah Harian state for biaya calculation
  const [targetData, setTargetData] = useState<TargetSection[]>([]);
  const [upahHarian, setUpahHarian] = useState(0);

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

  // Load users list and target data
  useEffect(() => {
    (async () => {
      const res = await UsersAPI.getAll();
      if (res && res.success) {
        const peserta = (res.data || []).filter((u: User) => u.role === 'user');
        setUsers(peserta);
      }
    })();
    (async () => {
      const [targetRes, upahRes] = await Promise.all([
        TargetSectionAPI.getAll(),
        TargetSectionAPI.getUpahHarian(),
      ]);
      if (targetRes && targetRes.success) setTargetData(targetRes.data || []);
      if (upahRes && upahRes.success) setUpahHarian(upahRes.data.upahHarian || 0);
    })();
  }, []);

  // Helper: get biaya per berkas for a given job desk
  const getBiayaPerBerkas = (jobDesk: string): number => {
    const target = targetData.find((t) => t.jenis.toLowerCase() === jobDesk.toLowerCase());
    if (!target || target.targetPerDay <= 0 || upahHarian <= 0) return 0;
    return upahHarian / target.targetPerDay;
  };

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
  // Rekapitulasi uses 26th prev month → 25th current month
  useEffect(() => {
    if (filterType === 'bulanan') {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      // Start: 26th of previous month
      const start = new Date(year, month - 1, 26);
      // End: 25th of current month
      const end = new Date(year, month, 25);

      const fmt = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

      setDateFrom(fmt(start));
      setDateTo(fmt(end));
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

    const monthName = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'][monthIndex];

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
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => <div key={d} className="calendar-weekday">{d}</div>)}
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

    // Build filter info string
    let filterInfoStr = '';
    if (filterType === 'bulanan') {
      const monthName = currentDate.toLocaleDateString('id-ID', { month: 'long' });
      const year = currentDate.getFullYear();
      filterInfoStr = `Bulanan — ${monthName} ${year}`;
    } else if (filterType === 'custom' && dateFrom && dateTo) {
      const f = new Date(dateFrom).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
      const t = new Date(dateTo).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
      filterInfoStr = `Custom — ${f} s/d ${t}`;
    }

    try {
      await exportRekapitulasiExcel(
        jenisList,
        pivotRows,
        totalsRow,
        grandTotalAll,
        filterInfoStr || undefined,
        upahHarian > 0 ? { upahHarian, getBiayaPerBerkas } : undefined,
      );
      showToast('Berhasil mengekspor data ke Excel', 'success');
    } catch (err) {
      console.error('Export error:', err);
      showToast('Gagal mengekspor data', 'error');
    }
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

      {/* ===== BIAYA PER BERKAS TABLE ===== */}
      {pivotRows.length > 0 && upahHarian > 0 && (
        <div className="rekap-table-card" style={{ marginTop: 24 }}>
          {/* <div style={{ padding: '16px 3px', borderBottom: '1px solid var(--gray-200)' }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--gray-800)' }}>Rincian Biaya</h2>
            <p style={{ margin: '4px 0 8px', fontSize: 12, color: 'var(--gray-500)' }}>
              Biaya = jumlah item × (Upah Harian / Target per section)
            </p>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 12px', background: 'linear-gradient(135deg, #f0f9ff, #e0f2fe)', border: '1px solid #bae6fd', borderRadius: 8, fontSize: 13, color: '#0369a1' }}>
              Upah Harian: <strong style={{ fontWeight: 800 }}>{formatRupiah(upahHarian)}</strong>
            </span>
          </div> */}
          <div className="rekap-table-wrapper">
            <table className="rekap-table rekap-biaya-table">
              <thead>
                <tr>
                  <th rowSpan={2} className="rekap-th-sticky">NAMA PESERTA</th>
                  {jenisList.map((j) => {
                    const rate = getBiayaPerBerkas(j);
                    return (
                      <th key={j} colSpan={4} className="rekap-th-group rekap-biaya-th-group">
                        {j.toUpperCase()}
                        {rate > 0 && (
                          <div style={{ fontSize: 10, fontWeight: 500, opacity: 0.75, marginTop: 2 }}>
                            {formatRupiah(rate)}/item
                          </div>
                        )}
                      </th>
                    );
                  })}
                  <th rowSpan={2} className="rekap-th-total">TOTAL</th>
                </tr>
                <tr>
                  {jenisList.map((j) => (
                    <React.Fragment key={j + '-sub-biaya'}>
                      <th className="rekap-th-sub">BERKAS</th>
                      <th className="rekap-th-sub">BUKU</th>
                      <th className="rekap-th-sub">BUNDLE</th>
                      <th className="rekap-th-sub rekap-th-sub-total">TOTAL</th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pivotRows.map((row) => {
                  let rowGrandBiaya = 0;
                  return (
                    <tr key={row.userId + '-biaya'}>
                      <td className="rekap-td-name">{row.userName}</td>
                      {jenisList.map((j) => {
                        const c = row.cells[j] || { berkas: 0, buku: 0, bundle: 0, total: 0 };
                        const rate = getBiayaPerBerkas(j);
                        const bBerkas = c.berkas * rate;
                        const bBuku = c.buku * rate;
                        const bBundle = c.bundle * rate;
                        const bTotal = bBerkas + bBuku + bBundle;
                        rowGrandBiaya += bTotal;
                        return (
                          <React.Fragment key={j}>
                            <td className="rekap-td-num rekap-td-biaya">{rate > 0 ? formatRupiah(bBerkas) : '-'}</td>
                            <td className="rekap-td-num rekap-td-biaya">{rate > 0 ? formatRupiah(bBuku) : '-'}</td>
                            <td className="rekap-td-num rekap-td-biaya">{rate > 0 ? formatRupiah(bBundle) : '-'}</td>
                            <td className="rekap-td-num rekap-td-subtotal rekap-td-biaya">{rate > 0 ? formatRupiah(bTotal) : '-'}</td>
                          </React.Fragment>
                        );
                      })}
                      <td className="rekap-td-num rekap-td-grandtotal rekap-td-biaya">{formatRupiah(rowGrandBiaya)}</td>
                    </tr>
                  );
                })}
                <tr className="rekap-total-row">
                  <td className="rekap-td-name" style={{ fontWeight: 800 }}>TOTAL</td>
                  {jenisList.map((j) => {
                    const rate = getBiayaPerBerkas(j);
                    return (
                      <React.Fragment key={j + '-tot-biaya'}>
                        <td className="rekap-td-num rekap-td-biaya">{rate > 0 ? formatRupiah(totalsRow[j].berkas * rate) : '-'}</td>
                        <td className="rekap-td-num rekap-td-biaya">{rate > 0 ? formatRupiah(totalsRow[j].buku * rate) : '-'}</td>
                        <td className="rekap-td-num rekap-td-biaya">{rate > 0 ? formatRupiah(totalsRow[j].bundle * rate) : '-'}</td>
                        <td className="rekap-td-num rekap-td-subtotal rekap-td-biaya">{rate > 0 ? formatRupiah(totalsRow[j].total * rate) : '-'}</td>
                      </React.Fragment>
                    );
                  })}
                  <td className="rekap-td-num rekap-td-grandtotal rekap-td-biaya">
                    {formatRupiah(jenisList.reduce((sum, j) => sum + totalsRow[j].total * getBiayaPerBerkas(j), 0))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Rekapitulasi;
