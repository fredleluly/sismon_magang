import React, { useEffect, useState, useCallback, useRef } from 'react';
import { ComplaintAPI } from '../../services/api';
import { exportExcel } from '../../utils/excelExport';
import { useToast } from '../../context/ToastContext';
import CustomSelect from '../../components/CustomSelect';
import type { Complaint } from '../../types';

const KelolaKeluhan: React.FC = () => {
  const { showToast } = useToast();
  const [all, setAll] = useState<Complaint[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [prioFilter, setPrioFilter] = useState('');

  // ── Date Filter State (same as Rekapitulasi) ──
  const [filterType, setFilterType] = useState<'bulanan' | 'custom'>('bulanan');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Custom Date Picker State
  const [isSelectingDateRange, setIsSelectingDateRange] = useState(false);
  const [datePickerMonth, setDatePickerMonth] = useState(new Date());
  const [tempDateRangeStart, setTempDateRangeStart] = useState<string>('');
  const [tempDateRangeEnd, setTempDateRangeEnd] = useState<string>('');
  const [isSelectingStart, setIsSelectingStart] = useState(true);

  const dateRangeRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const res = await ComplaintAPI.getAll();
    if (res && res.success) setAll(res.data || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Update dates when filter type or month changes
  useEffect(() => {
    if (filterType === 'bulanan') {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 0);
      const startStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
      const endStr = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
      setDateFrom(startStr);
      setDateTo(endStr);
    }
  }, [filterType, currentDate]);

  // Close date picker on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dateRangeRef.current && !dateRangeRef.current.contains(e.target as Node)) {
        setIsSelectingDateRange(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handlePrevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  const handleNextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));

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
    const days: React.ReactNode[] = [];

    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${offset}-${i}`} className="custom-calendar-day empty" />);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const inRange = isDateInRange(year, monthIndex, d);
      const startEnd = isDateStartEnd(year, monthIndex, d);
      let cls = 'custom-calendar-day';
      if (startEnd === 'start') cls += ' range-start';
      else if (startEnd === 'end') cls += ' range-end';
      else if (inRange) cls += ' in-range';

      days.push(
        <div key={`${offset}-${d}`} className={cls} onClick={() => handleCalendarDateClick(year, monthIndex, d)}>
          {d}
        </div>
      );
    }

    return (
      <div className="custom-calendar-month">
        <div className="custom-calendar-title">
          {month.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
        </div>
        <div className="custom-calendar-header">
          {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map(d => (
            <div key={d} className="custom-calendar-day-label">{d}</div>
          ))}
        </div>
        <div className="custom-calendar-grid">{days}</div>
      </div>
    );
  };

  // ── Filtered data (date + search + status + priority) ──
  const filtered = all.filter(k => {
    // Date filter
    if (dateFrom && dateTo && k.createdAt) {
      const created = k.createdAt.substring(0, 10);
      if (created < dateFrom || created > dateTo) return false;
    }
    const q = search.toLowerCase();
    const matchQ = !q || (k.judul || '').toLowerCase().includes(q) || (k.deskripsi || '').toLowerCase().includes(q) || ((k.userId as any)?.name || '').toLowerCase().includes(q);
    const matchS = !statusFilter || k.status === statusFilter;
    const matchP = !prioFilter || k.prioritas === prioFilter;
    return matchQ && matchS && matchP;
  });

  const menunggu = all.filter(k => k.status === 'Menunggu').length;
  const diproses = all.filter(k => k.status === 'Diproses').length;
  const selesai = all.filter(k => k.status === 'Selesai').length;

  const updateStatus = async (id: string, status: string) => {
    const res = await ComplaintAPI.updateStatus(id, status);
    if (res && res.success) { showToast(`Status diubah ke "${status}"`, 'success'); load(); }
    else showToast(res?.message || 'Gagal', 'error');
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

  // ── Export Excel ──
  const exportToExcel = async () => {
    if (filtered.length === 0) {
      showToast('Tidak ada data untuk diekspor', 'error');
      return;
    }

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

    const infoLines = [
      `Filter: ${filterInfoStr}`,
      `Total: ${filtered.length} keluhan`,
      `Menunggu: ${menunggu} | Diproses: ${diproses} | Selesai: ${selesai}`,
    ];
    if (search) infoLines.push(`Pencarian: "${search}"`);
    if (statusFilter) infoLines.push(`Status: ${statusFilter}`);
    if (prioFilter) infoLines.push(`Prioritas: ${prioFilter}`);

    try {
      await exportExcel({
        fileName: 'Kelola_Keluhan',
        companyName: 'SISMON Magang',
        creator: 'Admin',
        sheets: [{
          sheetName: 'Keluhan',
          title: 'LAPORAN KELUHAN PESERTA MAGANG',
          subtitle: 'Daftar keluhan dan status penanganan',
          infoLines,
          columns: [
            { header: 'No', key: 'no', width: 6, type: 'number' as const },
            { header: 'Tanggal', key: 'tanggal', width: 20 },
            { header: 'Nama Peserta', key: 'nama', width: 24 },
            { header: 'Judul', key: 'judul', width: 28 },
            { header: 'Kategori', key: 'kategori', width: 16 },
            { header: 'Prioritas', key: 'prioritas', width: 12 },
            { header: 'Status', key: 'status', width: 12 },
            { header: 'Deskripsi', key: 'deskripsi', width: 40 },
          ],
          data: filtered.map((k, i) => ({
            no: i + 1,
            tanggal: k.createdAt ? new Date(k.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-',
            nama: (k.userId as any)?.name || 'Unknown',
            judul: k.judul || 'Tanpa Judul',
            kategori: k.kategori || '-',
            prioritas: k.prioritas || '-',
            status: k.status || '-',
            deskripsi: k.deskripsi || '-',
          })),
        }],
      });
      showToast('Berhasil mengekspor data ke Excel', 'success');
    } catch (err) {
      console.error('Export error:', err);
      showToast('Gagal mengekspor data', 'error');
    }
  };

  return (
    <>
      <div className="page-header"><h1>Kelola Keluhan</h1><p>Kelola dan tanggapi laporan keluhan dari peserta magang</p></div>
      <div className="keluhan-stats-grid">
        <div className="keluhan-stat"><div className="ks-header"><span className="ks-label">Total</span></div><div className="ks-value">{all.length}</div></div>
        <div className="keluhan-stat"><div className="ks-header"><span className="ks-label">Menunggu</span></div><div className="ks-value">{menunggu}</div></div>
        <div className="keluhan-stat"><div className="ks-header"><span className="ks-label">Diproses</span></div><div className="ks-value">{diproses}</div></div>
        <div className="keluhan-stat"><div className="ks-header"><span className="ks-label">Selesai</span></div><div className="ks-value">{selesai}</div></div>
      </div>

      {/* ── Filter Bar (same layout/position as Rekapitulasi) ── */}
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
            <div className="custom-date-range-container" ref={dateRangeRef}>
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

          {/* Existing search + status + priority filters */}
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari laporan..." className="keluhan-search-input" />
          <CustomSelect
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: '', label: 'Semua Status' },
              { value: 'Menunggu', label: 'Menunggu' },
              { value: 'Diproses', label: 'Diproses' },
              { value: 'Selesai', label: 'Selesai' },
            ]}
          />
          <CustomSelect
            value={prioFilter}
            onChange={setPrioFilter}
            options={[
              { value: '', label: 'Semua Prioritas' },
              { value: 'High', label: 'High' },
              { value: 'Medium', label: 'Medium' },
              { value: 'Low', label: 'Low' },
            ]}
          />
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

      {/* Info bar (same as Rekapitulasi) */}
      <div className="rekap-info-bar">
        <span className="rekap-info-badge">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
          {formatDateLabel()}
        </span>
        <span className="rekap-info-badge">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
          {filtered.length} Keluhan
        </span>
      </div>

      {/* Complaint list */}
      <div className="keluhan-list-card mt-5">
        <h3>Daftar Keluhan</h3><p className="text-[13px] text-gray-500 mb-4">Menampilkan {filtered.length} dari {all.length} laporan</p>
        <div className="keluhan-scroll-container max-h-[500px] overflow-y-auto pr-1">
          {filtered.length === 0 ? (
            <div className="text-center p-10 text-gray-400">Tidak ada laporan ditemukan</div>
          ) : (
            filtered.map((k, i) => {
              const date = k.createdAt ? new Date(k.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
              const userName = (k.userId as any)?.name || 'Unknown';
              const prioClass = k.prioritas === 'High' ? 'high' : k.prioritas === 'Medium' ? 'medium' : 'low';
              const statusCls = k.status === 'Menunggu' ? 'bg-amber-100 text-amber-600' : k.status === 'Diproses' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-100 text-emerald-600';
              return (
                <div key={k._id} className="p-5 border border-gray-200 rounded-lg mb-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[15px] font-semibold text-gray-800">{k.judul || 'Tanpa Judul'}</span>
                    <span className="text-xs text-gray-400">{date}</span>
                  </div>
                  <div className="text-[13px] text-gray-500 mb-1">
                    <strong>{userName}</strong>
                  </div>
                  <div className="text-[13px] text-gray-500 mb-3">{(k.deskripsi || '').substring(0, 120)}</div>
                  <div className="flex gap-2 items-center flex-wrap">
                    <span className={`inline-flex px-3 py-0.5 rounded-full text-[11px] font-semibold ${statusCls}`}>{k.status}</span>
                    <span className={`priority-badge ${prioClass}`}>{k.prioritas}</span>
                    <span className="category-badge">{k.kategori}</span>
                    {k.status !== 'Selesai' && (
                      <div className="ml-auto flex gap-1.5">
                        <button className="btn-outline px-3.5 py-1 text-[11px]" onClick={() => updateStatus(k._id, 'Diproses')}>
                          Proses
                        </button>
                        <button className="btn btn-primary px-3.5 py-1 text-[11px]" onClick={() => updateStatus(k._id, 'Selesai')}>
                          Selesai
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
};

export default KelolaKeluhan;
