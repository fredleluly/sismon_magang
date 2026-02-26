import React, { useEffect, useState, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import { exportExcel } from '../../utils/excelExport';
import { WorkLogAPI, UsersAPI, TargetSectionAPI } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import CustomSelect from '../../components/CustomSelect';
import type { WorkLog, User, TargetSection } from '../../types';

const LogAktivitas: React.FC = () => {
  const { showToast } = useToast();
  const [logs, setLogs] = useState<WorkLog[]>([]);
  const [search, setSearch] = useState('');

  // Edit Modal State
  const [editModal, setEditModal] = useState<{ show: boolean; log: WorkLog | null }>({ show: false, log: null });
  const [editForm, setEditForm] = useState({ jenis: '', keterangan: '', berkas: 0, buku: 0, bundle: 0 });
  const [isSaving, setIsSaving] = useState(false);

  // Delete Confirm State
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; id: string | null; name: string; isBulk?: boolean }>({ show: false, id: null, name: '', isBulk: false });

  // Selection State
  const [selectedLogs, setSelectedLogs] = useState<string[]>([]);

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
  // Job Desk State
  const [jobDesks, setJobDesks] = useState<TargetSection[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [showUserFilter, setShowUserFilter] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const filterRef = useRef<HTMLDivElement>(null);

  // Section Filter State
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [showSectionFilter, setShowSectionFilter] = useState(false);
  const [sectionSearch, setSectionSearch] = useState('');
  const sectionFilterRef = useRef<HTMLDivElement>(null);

  // Load users for filter
  useEffect(() => {
    const loadUsers = async () => {
      const res = await UsersAPI.getAll();
      if (res && res.success) {
        const filteredUsers = res.data.filter((u: User) => u.role !== 'admin');
        const sortedUsers = filteredUsers.sort((a: User, b: User) => a.name.localeCompare(b.name));
        setUsers(sortedUsers);
      }
    };
    loadUsers();

    const loadJobDesks = async () => {
      const res = await TargetSectionAPI.getAll();
      if (res && res.success) {
        setJobDesks(res.data || []);
      }
    };
    loadJobDesks();

    // Click outside to close dropdowns
    const handleClickOutside = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setShowUserFilter(false);
      }
      if (sectionFilterRef.current && !sectionFilterRef.current.contains(event.target as Node)) {
        setShowSectionFilter(false);
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
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const start = new Date(year, month - 1, 26);
        const end = new Date(year, month, 25);

        const formatStr = (d: Date) => {
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${d.getFullYear()}-${m}-${day}`;
        };

        query += `&from=${formatStr(start)}&to=${formatStr(end)}`;
      } else if (filterType === 'custom' && dateFrom && dateTo) {
        query += `&from=${dateFrom}&to=${dateTo}`;
      }

      // Add user filter
      if (selectedUsers.length > 0) {
        query += `&userIds=${selectedUsers.join(',')}`;
      }

      const res = await WorkLogAPI.getAll(query);
      if (res && res.success) {
        setLogs(res.data || []);
        setSelectedLogs([]);
      } else {
        // If error or no data, default to empty but don't show error toast on initial empty state if just no data found
        setLogs([]);
        setSelectedLogs([]);
        // showToast('Gagal memuat data', 'error'); // Optional: suppress to avoid noise
      }
    } catch (err) {
      showToast('Gagal memuat data', 'error');
    }
  }, [filterType, currentDate, dateFrom, dateTo, selectedUsers]);

  // Open edit modal
  const openEditModal = (log: WorkLog) => {
    setEditForm({
      jenis: log.jenis || '',
      keterangan: log.keterangan || '',
      berkas: log.berkas || 0,
      buku: log.buku || 0,
      bundle: log.bundle || 0,
    });
    setEditModal({ show: true, log });
  };

  // Save edit from modal
  const handleSaveEdit = async () => {
    if (!editModal.log) return;
    setIsSaving(true);
    try {
      const res = await WorkLogAPI.update(editModal.log._id, editForm);
      if (res && res.success) {
        showToast('Data berhasil diperbarui', 'success');
        setEditModal({ show: false, log: null });
        load();
      } else {
        showToast(res?.message || 'Gagal memperbarui data', 'error');
      }
    } catch (err) {
      showToast('Gagal memperbarui data', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Confirm delete
  const confirmDelete = async () => {
    try {
      if (deleteConfirm.isBulk) {
        if (selectedLogs.length === 0) return;
        await Promise.all(selectedLogs.map((id) => WorkLogAPI.delete(id)));
        showToast(`${selectedLogs.length} data berhasil dihapus`, 'success');
        setSelectedLogs([]);
        load();
      } else {
        if (!deleteConfirm.id) return;
        const res = await WorkLogAPI.delete(deleteConfirm.id);
        if (res && res.success) {
          showToast('Data berhasil dihapus', 'success');
          load();
        } else {
          showToast(res?.message || 'Gagal menghapus data', 'error');
        }
      }
    } catch (err) {
      showToast('Gagal menghapus data', 'error');
    }
    setDeleteConfirm({ show: false, id: null, name: '', isBulk: false });
  };

  useEffect(() => {
    load();
  }, [load]);

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

  const toggleLogSelection = (id: string) => {
    setSelectedLogs((prev) => (prev.includes(id) ? prev.filter((logId) => logId !== id) : [...prev, id]));
  };

  const toggleAllLogs = () => {
    if (selectedLogs.length === filtered.length && filtered.length > 0) {
      setSelectedLogs([]);
    } else {
      setSelectedLogs(filtered.map((l) => l._id));
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
        <div key={day} className={`calendar-cell ${inRange ? 'in-range' : ''} ${isStart ? 'start-date' : ''} ${isEnd ? 'end-date' : ''}`} onClick={() => handleCalendarDateClick(year, monthIndex, day)}>
          {day}
        </div>,
      );
    }

    return (
      <div className="calendar-month-picker">
        <div className="calendar-month-header">
          <h3>
            {monthName} {year}
          </h3>
        </div>
        <div className="calendar-weekdays">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d) => (
            <div key={d} className="calendar-weekday">
              {d}
            </div>
          ))}
        </div>
        <div className="calendar-days">{days}</div>
      </div>
    );
  };
  // -------------------------

  const toggleSection = (jenis: string) => {
    setSelectedSections((prev) => (prev.includes(jenis) ? prev.filter((s) => s !== jenis) : [...prev, jenis]));
  };

  const selectAllSections = () => {
    if (selectedSections.length === jobDesks.length) {
      setSelectedSections([]);
    } else {
      setSelectedSections(jobDesks.map((j) => j.jenis));
    }
  };

  const filtered = logs
    .filter((l) => {
      // Section filter
      if (selectedSections.length > 0 && selectedSections.length < jobDesks.length) {
        if (!selectedSections.includes(l.jenis)) return false;
      }
      const q = search.toLowerCase();
      return (l.userId as any)?.name?.toLowerCase().includes(q) || (l.jenis || '').toLowerCase().includes(q) || (l.keterangan || '').toLowerCase().includes(q);
    })
    .sort((a, b) => {
      const dateA = a.tanggal ? new Date(a.tanggal).getTime() : 0;
      const dateB = b.tanggal ? new Date(b.tanggal).getTime() : 0;
      return dateB - dateA;
    });

  const avColors = ['av-a', 'av-b', 'av-c', 'av-d', 'av-e'];

  const exportToExcel = async () => {
    if (filtered.length === 0) {
      showToast('Tidak ada data untuk diekspor', 'error');
      return;
    }

    // Build filter info
    let filterInfoStr = '';
    if (filterType === 'bulanan') {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const start = new Date(year, month - 1, 26);
      const end = new Date(year, month, 25);
      const f = start.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
      const t = end.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
      filterInfoStr = `Bulanan — ${f} s/d ${t}`;
    } else if (filterType === 'custom' && dateFrom && dateTo) {
      const f = new Date(dateFrom).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
      const t = new Date(dateTo).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
      filterInfoStr = `Custom — ${f} s/d ${t}`;
    }

    const data = filtered.map((l, i) => ({
      no: i + 1,
      namaPeserta: (l.userId as any)?.name || 'Unknown',
      tanggal: l.tanggal ? new Date(l.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-',
      jenisPekerjaan: l.jenis || '-',
      keterangan: l.keterangan || '-',
      berkas: l.berkas || 0,
      buku: l.buku || 0,
      bundle: l.bundle || 0,
    }));

    try {
      await exportExcel({
        fileName: 'Log_Aktivitas',
        sheets: [
          {
            sheetName: 'Log Aktivitas',
            title: 'LOG AKTIVITAS PEKERJAAN',
            subtitle: 'Data aktivitas pekerjaan peserta magang',
            infoLines: [`Total Data: ${filtered.length}`, ...(filterInfoStr ? [`Filter: ${filterInfoStr}`] : [])],
            columns: [
              { header: 'No', key: 'no', type: 'number', width: 6 },
              { header: 'Nama Peserta', key: 'namaPeserta', type: 'string', width: 22 },
              { header: 'Tanggal', key: 'tanggal', type: 'string', width: 20 },
              { header: 'Jenis Pekerjaan', key: 'jenisPekerjaan', type: 'string', width: 18 },
              { header: 'Keterangan', key: 'keterangan', type: 'string', width: 30 },
              { header: 'Berkas', key: 'berkas', type: 'number', width: 10 },
              { header: 'Buku', key: 'buku', type: 'number', width: 10 },
              { header: 'Bundle', key: 'bundle', type: 'number', width: 10 },
            ],
            data,
          },
        ],
      });
      showToast('Berhasil mengekspor data ke Excel', 'success');
    } catch (err) {
      console.error('Export error:', err);
      showToast('Gagal mengekspor data', 'error');
    }
  };

  return (
    <>
      <div className="page-header-row">
        <div className="page-header">
          <h1>Log Aktivitas</h1>
          <p>Pantau aktivitas pekerjaan seluruh peserta magang</p>
        </div>
      </div>

      {/* Filters (Rekapitulasi Style) */}
      <div className="work-filter-bar">
        <div className="work-filter-left">
          <div className="filter-buttons">
            <button className={`filter-btn ${filterType === 'bulanan' ? 'active' : ''}`} onClick={() => setFilterType('bulanan')}>
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
          </div>

          <div className="month-user-row">
            {filterType === 'bulanan' ? (
              <div className="month-picker-container">
                <button className="month-nav-btn" onClick={handlePrevMonth}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6"></polyline>
                  </svg>
                </button>
                <span className="month-display">{currentDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</span>
                <button className="month-nav-btn" onClick={handleNextMonth}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </button>
              </div>
            ) : (
              <div className="custom-date-range-container">
                <button className="custom-date-range-toggle" onClick={() => setIsSelectingDateRange(!isSelectingDateRange)}>
                  {dateFrom && dateTo ? `${dateFrom} - ${dateTo}` : 'Pilih Rentang Tanggal'}
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
                      <button className="custom-date-nav-btn" onClick={handleDatePickerPrevMonth}>
                        ←
                      </button>
                      <span>Pilih Rentang Tanggal</span>
                      <button className="custom-date-nav-btn" onClick={handleDatePickerNextMonth}>
                        →
                      </button>
                    </div>

                    <div className="custom-calendars-container">
                      {renderCalendarMonth(0)}
                      {renderCalendarMonth(1)}
                    </div>

                    <div className="custom-date-range-info">
                      {tempDateRangeStart && !tempDateRangeEnd && <p>Pilih tanggal akhir</p>}
                      {tempDateRangeStart && tempDateRangeEnd && (
                        <p>
                          {tempDateRangeStart} sampai {tempDateRangeEnd}
                        </p>
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
              <button className="rekap-user-btn" onClick={() => setShowUserFilter(!showUserFilter)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                </svg>
                {selectedUsers.length === 0 ? 'Semua Peserta' : selectedUsers.length === users.length ? 'Semua Peserta' : `${selectedUsers.length} Peserta`}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="rekap-user-btn-icon-right">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {showUserFilter && (
                <div className="rekap-user-dropdown">
                  <div style={{ padding: '8px 12px' }}>
                    <input
                      type="text"
                      placeholder="Cari peserta..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        width: '100%',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: '1px solid var(--gray-300)',
                        fontSize: '13px',
                      }}
                    />
                  </div>
                  <div className="rekap-user-option" onClick={selectAllUsers}>
                    <input type="checkbox" checked={selectedUsers.length === users.length && users.length > 0} readOnly />
                    <span style={{ fontWeight: 600 }}>Pilih Semua</span>
                  </div>
                  <div className="rekap-user-dropdown-divider" />
                  <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
                    {users
                      .filter((u) => u.name.toLowerCase().includes(userSearch.toLowerCase()))
                      .map((u) => (
                        <div key={u._id} className="rekap-user-option" onClick={() => toggleUser(u._id)}>
                          <input type="checkbox" checked={selectedUsers.includes(u._id)} readOnly />
                          <span>
                            {u.name}
                            {u.status === 'Nonaktif' && <span style={{ fontSize: '11px', color: '#ef4444', marginLeft: '6px', fontWeight: 600 }}>(Nonaktif)</span>}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>

            {/* Section Filter Dropdown */}
            <div className="rekap-filter-group rekap-user-filter rekap-user-filter-container" ref={sectionFilterRef}>
              <button className="rekap-user-btn" onClick={() => setShowSectionFilter(!showSectionFilter)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                  <line x1="12" y1="22.08" x2="12" y2="12" />
                </svg>
                {selectedSections.length === 0 ? 'Semua Section' : selectedSections.length === jobDesks.length ? 'Semua Section' : `${selectedSections.length} Section`}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="rekap-user-btn-icon-right">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {showSectionFilter && (
                <div className="rekap-user-dropdown">
                  <div style={{ padding: '8px 12px' }}>
                    <input
                      type="text"
                      placeholder="Cari section..."
                      value={sectionSearch}
                      onChange={(e) => setSectionSearch(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        width: '100%',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: '1px solid var(--gray-300)',
                        fontSize: '13px',
                      }}
                    />
                  </div>
                  <div className="rekap-user-option" onClick={selectAllSections}>
                    <input type="checkbox" checked={selectedSections.length === jobDesks.length && jobDesks.length > 0} readOnly />
                    <span style={{ fontWeight: 600 }}>Pilih Semua</span>
                  </div>
                  <div className="rekap-user-dropdown-divider" />
                  <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
                    {jobDesks
                      .filter((j) => j.jenis.toLowerCase().includes(sectionSearch.toLowerCase()))
                      .map((j) => (
                        <div key={j._id} className="rekap-user-option" onClick={() => toggleSection(j.jenis)}>
                          <input type="checkbox" checked={selectedSections.includes(j.jenis)} readOnly />
                          <span>{j.jenis}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>

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
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          {(() => {
            if (filterType === 'bulanan') {
              const year = currentDate.getFullYear();
              const month = currentDate.getMonth();
              const start = new Date(year, month - 1, 26);
              const end = new Date(year, month, 25);
              const f = start.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
              const t = end.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
              return `${f} — ${t}`;
            } else if (filterType === 'custom' && dateFrom && dateTo) {
              const f = new Date(dateFrom).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
              const t = new Date(dateTo).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
              return `${f} — ${t}`;
            }
            if (dateFrom) return `Dari ${new Date(dateFrom).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`;
            if (dateTo) return `Sampai ${new Date(dateTo).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`;
            return 'Semua Tanggal';
          })()}
        </span>
        <div className="rekap-info-pair">
          <span className="rekap-info-badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
            </svg>
            {new Set(logs.map((l) => (l.userId as any)?._id || l.userId)).size} Peserta
          </span>
          <span className="rekap-info-badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            Total: {logs.length.toLocaleString('id-ID')}
          </span>
        </div>
      </div>

      {/* Search Bar */}
      <div className="log-table-card">
        <div className="peserta-table-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="pth-left">
            <h3>Aktivitas Terbaru</h3>
          </div>
          {selectedLogs.length > 0 && (
            <button
              onClick={() => setDeleteConfirm({ show: true, id: null, name: '', isBulk: true })}
              style={{
                padding: '6px 12px',
                fontSize: '13px',
                background: '#fee2e2',
                color: '#ef4444',
                border: '1px solid #fca5a5',
                borderRadius: '10px',
                cursor: 'pointer',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                transition: 'all 0.2s ease',
                minWidth: 'fit-content',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = '#fecaca';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = '#fee2e2';
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
              Hapus {selectedLogs.length} Terpilih
            </button>
          )}
        </div>
        <div className="table-container">
          <table className="log-table">
            <colgroup>
              <col style={{ width: '4%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '23%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '8%' }} />
            </colgroup>
            <thead>
              <tr>
                <th style={{ textAlign: 'center' }}>
                  <input type="checkbox" checked={selectedLogs.length === filtered.length && filtered.length > 0} onChange={toggleAllLogs} style={{ cursor: 'pointer' }} />
                </th>
                <th>Nama Peserta</th>
                <th>Tanggal</th>
                <th>Jenis Pekerjaan</th>
                <th>Keterangan</th>
                <th>Berkas</th>
                <th>Buku</th>
                <th>Bundle</th>
                <th style={{ textAlign: 'center' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--gray-400)' }}>
                    Belum ada data
                  </td>
                </tr>
              ) : (
                filtered.map((l, i) => {
                  const name = (l.userId as any)?.name || 'Unknown';
                  const dateStr = l.tanggal ? new Date(l.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
                  return (
                    <tr key={l._id} className={selectedLogs.includes(l._id) ? 'selected-row' : ''}>
                      <td style={{ textAlign: 'center' }}>
                        <input type="checkbox" checked={selectedLogs.includes(l._id)} onChange={() => toggleLogSelection(l._id)} style={{ cursor: 'pointer' }} />
                      </td>
                      <td>
                        <div className="user-cell">
                          <span className="user-name">{name}</span>
                        </div>
                      </td>
                      <td>{dateStr}</td>
                      <td>
                        <span className="job-badge">{l.jenis || '-'}</span>
                      </td>
                      <td style={{ maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={l.keterangan || '-'}>
                        {l.keterangan || '-'}
                      </td>
                      <td>
                        <span className="data-highlight">{l.berkas || 0}</span>
                      </td>
                      <td>
                        <span className="data-highlight">{l.buku || 0}</span>
                      </td>
                      <td>
                        <span className="data-highlight">{l.bundle || 0}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div className="action-btns" style={{ justifyContent: 'center' }}>
                          <button className="action-btn edit" onClick={() => openEditModal(l)} title="Edit">
                            ✏️
                          </button>
                          <button className="action-btn delete" onClick={() => setDeleteConfirm({ show: true, id: l._id, name, isBulk: false })} title="Hapus">
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {editModal.show &&
        editModal.log &&
        ReactDOM.createPortal(
          <div className="modal-overlay active">
            <div className="modal-card">
              <div className="modal-header">
                <h3>Edit Log Aktivitas</h3>
                <div className="modal-close" onClick={() => setEditModal({ show: false, log: null })}>
                  ✕
                </div>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label>Nama Peserta</label>
                  <input type="text" value={(editModal.log.userId as any)?.name || 'Unknown'} disabled style={{ background: 'var(--gray-100)', cursor: 'not-allowed' }} />
                </div>
                <div className="form-group">
                  <label>Tanggal</label>
                  <input
                    type="text"
                    value={editModal.log.tanggal ? new Date(editModal.log.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}
                    disabled
                    style={{ background: 'var(--gray-100)', cursor: 'not-allowed' }}
                  />
                </div>
                <div className="form-group">
                  <label>Jenis Pekerjaan</label>
                  <CustomSelect value={editForm.jenis} onChange={(val) => setEditForm({ ...editForm, jenis: val })} options={jobDesks.map((jd) => ({ value: jd.jenis, label: jd.jenis }))} placeholder="Pilih Jenis Pekerjaan" />
                </div>
                <div className="form-group">
                  <label>Keterangan</label>
                  <input type="text" value={editForm.keterangan} onChange={(e) => setEditForm({ ...editForm, keterangan: e.target.value })} placeholder="Keterangan pekerjaan" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label>Berkas</label>
                    <input type="number" min="0" value={editForm.berkas} onChange={(e) => setEditForm({ ...editForm, berkas: Number(e.target.value) })} />
                  </div>
                  <div className="form-group">
                    <label>Buku</label>
                    <input type="number" min="0" value={editForm.buku} onChange={(e) => setEditForm({ ...editForm, buku: Number(e.target.value) })} />
                  </div>
                  <div className="form-group">
                    <label>Bundle</label>
                    <input type="number" min="0" value={editForm.bundle} onChange={(e) => setEditForm({ ...editForm, bundle: Number(e.target.value) })} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn-outline" onClick={() => setEditModal({ show: false, log: null })}>
                  Batal
                </button>
                <button className="btn btn-primary" onClick={handleSaveEdit} disabled={isSaving}>
                  {isSaving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Delete Confirm Modal */}
      {deleteConfirm.show &&
        ReactDOM.createPortal(
          <div className="modal-overlay active">
            <div className="modal-card modal-delete-confirm">
              <div className="modal-header">
                <h3>Konfirmasi Penghapusan</h3>
                <div className="modal-close" onClick={() => setDeleteConfirm({ show: false, id: null, name: '', isBulk: false })}>
                  ✕
                </div>
              </div>
              <div className="modal-body">
                <p style={{ textAlign: 'center', color: '#666', marginBottom: '20px' }}>
                  {deleteConfirm.isBulk
                    ? `Apakah Anda yakin ingin menghapus ${selectedLogs.length} log aktivitas yang dipilih? Tindakan ini tidak dapat dibatalkan.`
                    : `Apakah Anda yakin ingin menghapus log aktivitas dari ${deleteConfirm.name}? Tindakan ini tidak dapat dibatalkan.`}
                </p>
              </div>
              <div className="modal-footer">
                <button className="btn-outline" onClick={() => setDeleteConfirm({ show: false, id: null, name: '', isBulk: false })}>
                  Batal
                </button>
                <button className="btn btn-danger" onClick={confirmDelete}>
                  Hapus
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
};

export default LogAktivitas;
