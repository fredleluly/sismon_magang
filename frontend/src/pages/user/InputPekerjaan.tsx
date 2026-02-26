import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import { WorkLogAPI, AttendanceAPI } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import type { WorkLog } from '../../types';
import CustomSelect from '../../components/CustomSelect';
import { formatJobType } from '../../utils/jobdesk';
import './InputPekerjaan.css';

const MONTH_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const DAY_NAMES = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

const toDateString = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const InputPekerjaan: React.FC = () => {
  const { showToast } = useToast();
  const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [jenis, setJenis] = useState('');
  const [keterangan, setKeterangan] = useState('');
  const [berkas, setBerkas] = useState(0);
  const [buku, setBuku] = useState(0);
  const [bundle, setBundle] = useState(0);
  const [pendingData, setPendingData] = useState<WorkLog[]>([]);

  // Calendar dropdown states
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [holidayDates, setHolidayDates] = useState<Set<string>>(new Set());
  const calendarRef = useRef<HTMLDivElement>(null);

  const loadPending = useCallback(async () => {
    const res = await WorkLogAPI.getAll('status=Draft');
    if (res && res.success) setPendingData(res.data || []);
  }, []);

  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    confirmText: string;
    type: 'danger' | 'primary';
    onConfirm: () => void;
  }>({ show: false, title: '', message: '', confirmText: '', type: 'primary', onConfirm: () => {} });

  const showConfirm = (title: string, message: string, confirmText: string, type: 'danger' | 'primary', onConfirm: () => void) => {
    setConfirmModal({ show: true, title, message, confirmText, type, onConfirm });
  };

  const closeConfirm = () => setConfirmModal((prev) => ({ ...prev, show: false }));

  // Add pause/blur effect on modal open
  useEffect(() => {
    const app = document.querySelector('.app-wrapper');
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        closeConfirm();
      }
    };

    if (confirmModal.show) {
      document.body.style.overflow = 'hidden';
      if (app) app.classList.add('paused');
      window.addEventListener('keydown', escHandler, true);
    } else {
      document.body.style.overflow = 'unset';
      if (app) app.classList.remove('paused');
    }

    return () => {
      document.body.style.overflow = 'unset';
      if (app) app.classList.remove('paused');
      window.removeEventListener('keydown', escHandler, true);
    };
  }, [confirmModal.show]);

  useEffect(() => {
    loadPending();
  }, [loadPending]);

  // Load holidays for the calendar month
  useEffect(() => {
    const loadHolidays = async () => {
      try {
        const year = calendarDate.getFullYear();
        const month = calendarDate.getMonth();
        const from = toDateString(new Date(year, month, 1));
        const to = toDateString(new Date(year, month + 1, 0));
        const res = await AttendanceAPI.getAll(`from=${from}&to=${to}&limit=100`);
        if (res && res.success && res.data) {
          const holidays = new Set<string>();
          (res.data as any[]).forEach((att: any) => {
            if (att.status === 'Hari Libur') {
              holidays.add(att.tanggal.split('T')[0]);
            }
          });
          setHolidayDates(holidays);
        }
      } catch (error) {
        console.error('Error loading holidays:', error);
      }
    };
    loadHolidays();
  }, [calendarDate]);

  // Close calendar on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) {
        setShowCalendar(false);
      }
    };
    if (showCalendar) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showCalendar]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jenis) {
      showToast('Pilih jenis pekerjaan terlebih dahulu!', 'error');
      return;
    }
    const data = { tanggal, jenis, keterangan, berkas, buku, bundle, status: 'Draft' as const };
    const res = await WorkLogAPI.create(data);
    if (res && res.success) {
      showToast('Data berhasil disimpan sebagai draft!', 'success');
      setJenis('');
      setKeterangan('');
      setBerkas(0);
      setBuku(0);
      setBundle(0);
      setTanggal(new Date().toISOString().split('T')[0]);
      loadPending();
    } else {
      showToast(res?.message || 'Gagal menyimpan', 'error');
    }
  };

  const submitPending = async (id: string) => {
    const res = await WorkLogAPI.submit(id);
    if (res && res.success) {
      showToast('Data berhasil dikirim final!', 'success');
      loadPending();
    } else showToast(res?.message || 'Gagal mengirim', 'error');
  };

  const submitAllPending = async () => {
    if (pendingData.length === 0) return;

    showConfirm('Kirim Semua Log?', `Apakah Anda yakin ingin mengirim semua ${pendingData.length} log pekerjaan status draft menjadi final? Data yang sudah final tidak dapat diubah lagi.`, 'Ya, Kirim Semua', 'primary', async () => {
      closeConfirm();
      let success = 0;
      let fail = 0;
      for (const item of pendingData) {
        const res = await WorkLogAPI.submit(item._id);
        if (res && res.success) success++;
        else fail++;
      }
      if (fail === 0) {
        showToast(`${success} data berhasil dikirim final!`, 'success');
      } else {
        showToast(`${success} berhasil, ${fail} gagal dikirim`, 'error');
      }
      loadPending();
    });
  };

  const deletePending = async (id: string) => {
    showConfirm('Hapus Log?', 'Apakah Anda yakin ingin menghapus log pekerjaan ini? Tindakan ini tidak dapat dibatalkan.', 'Ya, Hapus', 'danger', async () => {
      closeConfirm();
      const res = await WorkLogAPI.delete(id);
      if (res && res.success) {
        showToast('Data pending berhasil dihapus', 'success');
        loadPending();
      } else showToast(res?.message || 'Gagal menghapus', 'error');
    });
  };

  const editPending = async (id: string) => {
    const item = pendingData.find((i) => i._id === id);
    if (!item) return;
    setTanggal(new Date(item.tanggal).toISOString().split('T')[0]);
    setJenis(item.jenis);
    setKeterangan(item.keterangan || '');
    setBerkas(item.berkas);
    setBuku(item.buku);
    setBundle(item.bundle);
    await WorkLogAPI.delete(id);
    loadPending();
    showToast('Data dimuat untuk diedit', 'info');
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

  // Calendar helper: generate days for the month
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    return { firstDay, totalDays };
  };

  const handleCalendarDayClick = (day: number) => {
    const dateObj = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), day);
    const targetDate = toDateString(dateObj);
    const dayOfWeek = dateObj.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      showToast('Hari Sabtu/Minggu adalah hari libur, tidak dapat menginput pekerjaan.', 'error');
      return;
    }
    if (holidayDates.has(targetDate)) {
      showToast('Tanggal ini adalah Hari Libur, tidak dapat menginput pekerjaan.', 'error');
      return;
    }
    setTanggal(targetDate);
    setShowCalendar(false);
  };

  const handlePrevMonth = () => {
    setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1));
  };

  const { firstDay, totalDays } = getDaysInMonth(calendarDate);

  const formattedTanggal = new Date(tanggal + 'T00:00:00').toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="input-pekerjaan-layout">
      <div className="form-card">
        <div className="form-card-header">
          <div className="form-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </div>
          <h2>Formulir Log Harian</h2>
        </div>
        <p className="form-card-subtitle">Isi detail pekerjaan Anda hari ini.</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Tanggal</label>
            <div className="ip-calendar-wrapper" ref={calendarRef}>
              <button
                type="button"
                className="ip-calendar-trigger"
                onClick={() => {
                  // Sync calendar view to currently selected date
                  const d = new Date(tanggal + 'T00:00:00');
                  setCalendarDate(new Date(d.getFullYear(), d.getMonth(), 1));
                  setShowCalendar(!showCalendar);
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                <span>{formattedTanggal}</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="ip-calendar-chevron"
                  style={{ transform: showCalendar ? 'rotate(180deg)' : 'rotate(0deg)' }}
                >
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>

              {showCalendar && (
                <div className="ip-calendar-dropdown">
                  <div className="ip-calendar-header">
                    <button type="button" className="ip-calendar-nav" onClick={handlePrevMonth}>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="15 18 9 12 15 6" />
                      </svg>
                    </button>
                    <h4 className="ip-calendar-title">
                      {MONTH_NAMES[calendarDate.getMonth()]} {calendarDate.getFullYear()}
                    </h4>
                    <button type="button" className="ip-calendar-nav" onClick={handleNextMonth}>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </button>
                  </div>

                  <div className="ip-calendar-day-names">
                    {DAY_NAMES.map((name, idx) => (
                      <div key={name} className={`ip-day-name${idx === 0 || idx === 6 ? ' is-weekend' : ''}`}>
                        {name}
                      </div>
                    ))}
                  </div>

                  <div className="ip-calendar-grid">
                    {Array.from({ length: firstDay }, (_, i) => (
                      <div key={`e-${i}`} className="ip-calendar-empty" />
                    ))}
                    {Array.from({ length: totalDays }, (_, i) => {
                      const day = i + 1;
                      const dateObj = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), day);
                      const dateStr = toDateString(dateObj);
                      const dayOfWeek = dateObj.getDay();
                      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                      const isHoliday = holidayDates.has(dateStr);
                      const isSelected = tanggal === dateStr;
                      const isToday = dateStr === new Date().toISOString().split('T')[0];

                      return (
                        <div
                          key={day}
                          className={`ip-calendar-day${isSelected ? ' selected' : ''}${isHoliday ? ' is-holiday' : ''}${isWeekend ? ' is-weekend' : ''}${isToday ? ' is-today' : ''}`}
                          onClick={() => handleCalendarDayClick(day)}
                          title={isWeekend ? 'Hari Libur (Weekend)' : isHoliday ? 'Hari Libur' : ''}
                        >
                          <span className="ip-day-number">{day}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="form-group">
            <label>Jenis Pekerjaan (Jobdesk)</label>
            <CustomSelect
              value={jenis}
              onChange={setJenis}
              placeholder="Pilih Pekerjaan (Jobdesk)"
              options={[
                { value: 'Sortir', label: 'Sortir' },
                { value: 'Register', label: 'Registrasi' },
                { value: 'Pencopotan Steples', label: 'Pencopotan Staples' },
                { value: 'Scanning', label: 'Scanning' },
                { value: 'Rekardus', label: 'Rekardus' },
                { value: 'Stikering', label: 'Stikering' },
              ]}
            />
          </div>
          <div className="form-group">
            <label>Keterangan Berkas</label>
            <textarea value={keterangan} onChange={(e) => setKeterangan(e.target.value.toUpperCase())} placeholder="Masukkan keterangan berkas..." rows={3} />
          </div>
          <div className="form-row-3">
            <div className="form-group">
              <label>Jumlah Berkas</label>
              <input type="number" min="0" value={berkas} onChange={(e) => setBerkas(+e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Jumlah Buku</label>
              <input type="number" min="0" value={buku} onChange={(e) => setBuku(+e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Jumlah Bundle</label>
              <input type="number" min="0" value={bundle} onChange={(e) => setBundle(+e.target.value)} required />
            </div>
          </div>
          <button type="submit" className="btn btn-primary btn-full" style={{ marginTop: 8 }}>
            Simpan sebagai Draft
          </button>
        </form>
      </div>
      <div className="pending-list-card">
        <div className="pending-header">
          <h3>Data Pending</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="pending-count">{pendingData.length}</span>
            {pendingData.length > 1 && (
              <button className="btn-send" onClick={submitAllPending} style={{ fontSize: '12px', padding: '4px 12px' }}>
                Kirim Semua
              </button>
            )}
          </div>
        </div>
        <p className="pending-subtitle">Data yang belum dikirim final.</p>
        <div>
          {pendingData.length === 0 ? (
            <div className="pending-empty">
              <p>Belum ada data pending</p>
            </div>
          ) : (
            pendingData.map((item) => (
              <div key={item._id} className="pending-item">
                <div className="pending-item-header">
                  <div>
                    <div className="pending-item-title">{formatJobType(item.jenis)}</div>
                    <div className="pending-item-date">{formatDate(item.tanggal)}</div>
                  </div>
                  <button className="pending-item-delete" onClick={() => deletePending(item._id)} title="Hapus">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
                {item.keterangan && (
                  <div className="pending-item-keterangan" style={{ fontSize: 13, color: '#64748b', marginBottom: 8, padding: '6px 10px', background: '#f8fafc', borderRadius: 6, borderLeft: '3px solid #0ea5e9' }}>
                    <span className="label" style={{ display: 'block', marginBottom: 2 }}>
                      Keterangan:
                    </span>
                    <span>{item.keterangan}</span>
                  </div>
                )}
                <div className="pending-item-body">
                  <div>
                    <span className="label">Berkas:</span>
                    <span>{item.berkas}</span>
                  </div>
                  <div>
                    <span className="label">Buku:</span>
                    <span>{item.buku}</span>
                  </div>
                  <div>
                    <span className="label">Bundle:</span>
                    <span>{item.bundle}</span>
                  </div>
                </div>
                <div className="pending-item-footer">
                  <button className="btn-send" onClick={() => submitPending(item._id)}>
                    Kirim Final
                  </button>
                  <button className="btn-edit" onClick={() => editPending(item._id)}>
                    Edit
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Confirm Modal (Portal) */}
      {confirmModal.show &&
        ReactDOM.createPortal(
          <div className="modal-overlay active" style={{ zIndex: 9999 }}>
            <div className="modal-card" style={{ maxWidth: '400px', textAlign: 'center' }}>
              <div className="modal-body" style={{ padding: '32px 24px 24px' }}>
                <div
                  className={`confirm-icon-wrap ${confirmModal.type}`}
                  style={{
                    margin: '0 auto 16px',
                    width: 64,
                    height: 64,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: confirmModal.type === 'danger' ? '#fee2e2' : '#e0f2fe',
                    color: confirmModal.type === 'danger' ? '#ef4444' : '#0ea5e9',
                  }}
                >
                  {confirmModal.type === 'danger' ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                      <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                  )}
                </div>

                <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: '#1e293b' }}>{confirmModal.title}</h3>
                <p style={{ fontSize: 14, color: '#64748b', marginBottom: 24, lineHeight: 1.5 }}>{confirmModal.message}</p>

                <div style={{ display: 'flex', gap: 12 }}>
                  <button className="btn-outline" onClick={closeConfirm} style={{ flex: 1, justifyContent: 'center' }}>
                    Batal
                  </button>
                  <button className={`btn ${confirmModal.type === 'danger' ? 'btn-danger' : 'btn-primary'}`} onClick={confirmModal.onConfirm} style={{ flex: 1, justifyContent: 'center' }}>
                    {confirmModal.confirmText}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};

export default InputPekerjaan;
