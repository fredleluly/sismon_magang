import React, { useEffect, useState } from 'react';
import { WorkLogAPI } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import type { WorkLog } from '../../types';
import * as XLSX from 'xlsx';
import './RecapPekerjaan.css';

interface JobDeskRecap {
  jobDesk: string;
  berkas: number;
  buku: number;
  bundle: number;
  total: number;
}

const RecapPekerjaan: React.FC = () => {
  const { showToast } = useToast();

  // Helper functions
  const toDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // States
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filterType, setFilterType] = useState<'bulanan' | 'custom'>('bulanan');
  const [dateRangeStart, setDateRangeStart] = useState<string>('');
  const [dateRangeEnd, setDateRangeEnd] = useState<string>('');
  const [isSelectingDateRange, setIsSelectingDateRange] = useState(false);
  const [datePickerMonth, setDatePickerMonth] = useState(new Date());
  const [tempDateRangeStart, setTempDateRangeStart] = useState<string>('');
  const [tempDateRangeEnd, setTempDateRangeEnd] = useState<string>('');
  const [isSelectingStart, setIsSelectingStart] = useState(true);

  const [workData, setWorkData] = useState<WorkLog[]>([]);
  const [recapData, setRecapData] = useState<JobDeskRecap[]>([]);
  const [loading, setLoading] = useState(false);

  const getDateRangeForFilter = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    if (filterType === 'bulanan') {
      const startOfMonth = new Date(year, month, 1);
      const endOfMonth = new Date(year, month + 1, 0);
      return { from: toDateString(startOfMonth), to: toDateString(endOfMonth) };
    } else if (filterType === 'custom' && dateRangeStart && dateRangeEnd) {
      return { from: dateRangeStart, to: dateRangeEnd };
    }
    return { from: '', to: '' };
  };

  const loadWorkData = async () => {
    setLoading(true);
    try {
      const range = getDateRangeForFilter();
      if (!range.from || !range.to) {
        showToast('Silakan pilih rentang tanggal', 'error');
        setLoading(false);
        return;
      }

      const res = await WorkLogAPI.getAll(`from=${range.from}&to=${range.to}&status=Selesai&limit=1000`);
      if (res && res.success) {
        setWorkData(res.data || []);
        generateRecap(res.data || []);
      } else {
        showToast('Gagal memuat data pekerjaan', 'error');
      }
    } catch (error) {
      showToast('Error memuat data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const generateRecap = (data: WorkLog[]) => {
    const recapMap: { [key: string]: JobDeskRecap } = {};

    data.forEach((work) => {
      const jobDesk = work.jenis;
      if (!recapMap[jobDesk]) {
        recapMap[jobDesk] = {
          jobDesk,
          berkas: 0,
          buku: 0,
          bundle: 0,
          total: 0,
        };
      }
      recapMap[jobDesk].berkas += work.berkas || 0;
      recapMap[jobDesk].buku += work.buku || 0;
      recapMap[jobDesk].bundle += work.bundle || 0;
      recapMap[jobDesk].total = recapMap[jobDesk].berkas + recapMap[jobDesk].buku + recapMap[jobDesk].bundle;
    });

    const recapArray = Object.values(recapMap).sort((a, b) => a.jobDesk.localeCompare(b.jobDesk));
    setRecapData(recapArray);
  };

  const handleFilterChange = (type: 'bulanan' | 'custom') => {
    setFilterType(type);
    if (type !== 'custom') {
      setIsSelectingDateRange(false);
    }
  };

  const handleDatePickerPrevMonth = () => {
    setDatePickerMonth(new Date(datePickerMonth.getFullYear(), datePickerMonth.getMonth() - 1));
  };

  const handleDatePickerNextMonth = () => {
    setDatePickerMonth(new Date(datePickerMonth.getFullYear(), datePickerMonth.getMonth() + 1));
  };

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
    const getDaysInMonth = () => new Date(year, monthIndex + 1, 0).getDate();
    const getFirstDayOfMonth = () => new Date(year, monthIndex, 1).getDay();

    const monthName = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'][monthIndex];

    const days = [];
    const firstDay = getFirstDayOfMonth();
    const daysInMonth = getDaysInMonth();

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
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day) => (
            <div key={day} className="calendar-weekday">
              {day}
            </div>
          ))}
        </div>
        <div className="calendar-days">{days}</div>
      </div>
    );
  };



  const downloadExcelByFilter = async () => {
    try {
      let dataToDownload = recapData;
      let dateRangeStr = '';
      let filename = '';

      if (filterType === 'bulanan') {
        const monthName = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'][currentDate.getMonth()];
        dateRangeStr = `${monthName} ${currentDate.getFullYear()}`;
        filename = `Recap-Pekerjaan-${monthName}-${currentDate.getFullYear()}.xlsx`;
      } else if (filterType === 'custom') {
        if (!dateRangeStart || !dateRangeEnd) {
          showToast('Pilih rentang tanggal terlebih dahulu', 'error');
          return;
        }
        dateRangeStr = `${dateRangeStart} sampai ${dateRangeEnd}`;
        filename = `Recap-Pekerjaan-${dateRangeStart}-sampai-${dateRangeEnd}.xlsx`;
      }

      if (dataToDownload.length === 0) {
        showToast('Tidak ada data untuk diunduh', 'error');
        return;
      }

      const wsData: any[] = [
        ['RECAP PEKERJAAN'],
        [dateRangeStr],
        [`Total Job Desk: ${dataToDownload.length}`],
        [],
        ['No', 'Job Desk', 'Berkas', 'Buku', 'Bundle', 'Total'],
      ];

      dataToDownload.forEach((recap, index) => {
        wsData.push([index + 1, recap.jobDesk, recap.berkas, recap.buku, recap.bundle, recap.total]);
      });

      // Add summary row
      const totalBerkas = dataToDownload.reduce((sum, item) => sum + item.berkas, 0);
      const totalBuku = dataToDownload.reduce((sum, item) => sum + item.buku, 0);
      const totalBundle = dataToDownload.reduce((sum, item) => sum + item.bundle, 0);
      const grandTotal = totalBerkas + totalBuku + totalBundle;

      wsData.push([]);
      wsData.push(['', 'TOTAL', totalBerkas, totalBuku, totalBundle, grandTotal]);

      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Recap');
      ws['!cols'] = [{ wch: 5 }, { wch: 20 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }];

      XLSX.writeFile(wb, filename);
      showToast('Excel berhasil diunduh!', 'success');
    } catch (error) {
      console.error('Error downloading Excel:', error);
      showToast('Gagal mengunduh Excel', 'error');
    }
  };

  useEffect(() => {
    loadWorkData();
  }, [filterType, dateRangeStart, dateRangeEnd, currentDate]);

  return (
    <>
      <div className="page-header">
        <h1>Recap Pekerjaan</h1>
        <p>Ringkasan pekerjaan per job desk untuk periode yang dipilih</p>
      </div>

      {/* Filter Bar */}
      <div className="recap-filter-bar">
        <div className="filter-buttons">
          <button
            className={`filter-btn ${filterType === 'bulanan' ? 'active' : ''}`}
            onClick={() => handleFilterChange('bulanan')}
          >
            Monthly
          </button>
          <button
            className={`filter-btn ${filterType === 'custom' ? 'active' : ''}`}
            onClick={() => {
              handleFilterChange('custom');
              if (!isSelectingDateRange) {
                setIsSelectingStart(true);
              }
            }}
          >
            Custom
          </button>
        </div>

        {filterType === 'custom' && (
          <div className="custom-date-range-container">
            <button
              className="custom-date-range-toggle"
              onClick={() => setIsSelectingDateRange(!isSelectingDateRange)}
            >
              {tempDateRangeStart && tempDateRangeEnd
                ? `${tempDateRangeStart} - ${tempDateRangeEnd}`
                : dateRangeStart && dateRangeEnd
                  ? `${dateRangeStart} - ${dateRangeEnd}`
                  : 'Select date range'}
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
                  <span>Select Date Range</span>
                  <button className="custom-date-nav-btn" onClick={handleDatePickerNextMonth}>
                    →
                  </button>
                </div>

                <div className="custom-calendars-container">
                  {renderCalendarMonth(0)}
                  {renderCalendarMonth(1)}
                </div>

                <div className="custom-date-range-info">
                  {tempDateRangeStart && !tempDateRangeEnd && <p>Select end date</p>}
                  {tempDateRangeStart && tempDateRangeEnd && (
                    <p>
                      {tempDateRangeStart} to {tempDateRangeEnd}
                    </p>
                  )}
                </div>

                <div className="custom-date-picker-footer">
                  <button
                    className="custom-date-apply-btn"
                    onClick={() => {
                      if (tempDateRangeStart && tempDateRangeEnd) {
                        setDateRangeStart(tempDateRangeStart);
                        setDateRangeEnd(tempDateRangeEnd);
                        setIsSelectingDateRange(false);
                        setIsSelectingStart(true);
                      } else {
                        showToast('Select start and end dates first', 'error');
                      }
                    }}
                  >
                    Apply
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
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="recap-content">
        <div className="recap-card">
          <div className="recap-header">
            <h2>Job Desk Summary</h2>
            {recapData.length > 0 && (
              <button
                onClick={downloadExcelByFilter}
                title="Download Excel"
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
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  style={{ width: '14px', height: '14px' }}
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Excel
              </button>
            )}
          </div>

          {loading ? (
            <div className="loading-state">
              <p>Loading data...</p>
            </div>
          ) : recapData.length === 0 ? (
            <div className="empty-state">
              <p>No work data found for the selected period</p>
            </div>
          ) : (
            <>
              <div className="table-wrapper">
                <table className="recap-table">
                  <thead>
                    <tr>
                      <th>No</th>
                      <th>Job Desk</th>
                      <th>Berkas</th>
                      <th>Buku</th>
                      <th>Bundle</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recapData.map((recap, index) => (
                      <tr key={index}>
                        <td className="number-cell">{index + 1}</td>
                        <td className="jobdesk-cell">{recap.jobDesk}</td>
                        <td className="number-cell">{recap.berkas}</td>
                        <td className="number-cell">{recap.buku}</td>
                        <td className="number-cell">{recap.bundle}</td>
                        <td className="number-cell total-cell">{recap.total}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={2} className="summary-cell">TOTAL</td>
                      <td className="number-cell summary-value">{recapData.reduce((sum, r) => sum + r.berkas, 0)}</td>
                      <td className="number-cell summary-value">{recapData.reduce((sum, r) => sum + r.buku, 0)}</td>
                      <td className="number-cell summary-value">{recapData.reduce((sum, r) => sum + r.bundle, 0)}</td>
                      <td className="number-cell summary-value total-cell">{recapData.reduce((sum, r) => sum + r.total, 0)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="recap-stats">
                <div className="stat-box">
                  <div className="stat-label">Total Job Desk</div>
                  <div className="stat-value">{recapData.length}</div>
                </div>
                <div className="stat-box grand-total">
                  <div className="stat-label">Grand Total</div>
                  <div className="stat-value">{recapData.reduce((sum, r) => sum + r.total, 0)}</div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>


    </>
  );
};

export default RecapPekerjaan;
