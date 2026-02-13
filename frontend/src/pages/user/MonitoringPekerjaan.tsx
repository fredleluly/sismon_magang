import React, { useEffect, useState, useRef } from "react";
import ReactDOM from "react-dom";
import { WorkLogAPI } from "../../services/api";
import { useToast } from "../../context/ToastContext";
import type { WorkLog } from "../../types";
import { exportExcel } from "../../utils/excelExport";
import "./MonitoringPekerjaan.css";

const MonitoringPekerjaan: React.FC = () => {
  const { showToast } = useToast();

  // Helper functions (must be defined before use in useState)
  const toDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const getDaysInMonth = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const getFirstDayOfMonth = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth(), 1).getDay();

  // Calendar states
  const [currentDate, setCurrentDate] = useState(new Date());
  const [workData, setWorkData] = useState<WorkLog[]>([]);
  const [selectedDayData, setSelectedDayData] = useState<WorkLog[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);

  // Filter states
  const [filterType, setFilterType] = useState<
    "harian" | "mingguan" | "bulanan" | "custom"
  >("bulanan");
  const [dateRangeStart, setDateRangeStart] = useState<string>("");
  const [dateRangeEnd, setDateRangeEnd] = useState<string>("");
  const [isSelectingDateRange, setIsSelectingDateRange] = useState(false);
  const [datePickerMonth, setDatePickerMonth] = useState(new Date());
  const [tempDateRangeStart, setTempDateRangeStart] = useState<string>("");
  const [tempDateRangeEnd, setTempDateRangeEnd] = useState<string>("");
  const [isSelectingStart, setIsSelectingStart] = useState(true);

  // Statistics states
  const [stats, setStats] = useState({
    totalBerkas: 0,
    totalBuku: 0,
    totalBundle: 0,
  });

  // Export Modal states
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportSelectedDate, setExportSelectedDate] = useState(
    toDateString(new Date()),
  );
  const [exportHarianMonth, setExportHarianMonth] = useState(new Date());
  const [exportDateRangeStart, setExportDateRangeStart] = useState<string>("");
  const [exportDateRangeEnd, setExportDateRangeEnd] = useState<string>("");
  const [exportDatePickerMonth, setExportDatePickerMonth] = useState(
    new Date(),
  );
  const [isExportDateRangeOpen, setIsExportDateRangeOpen] = useState(false);
  const [tempExportDateStart, setTempExportDateStart] = useState<string>("");
  const [tempExportDateEnd, setTempExportDateEnd] = useState<string>("");
  const [isExportSelectingStart, setIsExportSelectingStart] = useState(true);

  const getDateRangeForFilter = () => {
    const now = new Date();
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    if (filterType === "harian") {
      // Today
      const today = new Date();
      return { from: toDateString(today), to: toDateString(today) };
    } else if (filterType === "mingguan") {
      // Current week (Sunday to Saturday)
      const curr = new Date(now);
      const first = curr.getDate() - curr.getDay();
      const weekStart = new Date(curr.setDate(first));
      const weekEnd = new Date(curr.setDate(first + 6));
      return { from: toDateString(weekStart), to: toDateString(weekEnd) };
    } else if (filterType === "bulanan") {
      // Current month
      const startOfMonth = new Date(year, month, 1);
      const endOfMonth = new Date(year, month + 1, 0);
      return { from: toDateString(startOfMonth), to: toDateString(endOfMonth) };
    } else if (filterType === "custom" && dateRangeStart && dateRangeEnd) {
      return { from: dateRangeStart, to: dateRangeEnd };
    }
    return { from: "", to: "" };
  };

  const loadWorkData = async () => {
    setCalendarLoading(true);
    try {
      const range = getDateRangeForFilter();
      if (!range.from || !range.to) {
        showToast("Silakan pilih rentang tanggal", "error");
        setCalendarLoading(false);
        return;
      }

      const res = await WorkLogAPI.getAll(
        `from=${range.from}&to=${range.to}&status=Selesai&limit=1000`,
      );
      if (res && res.success) {
        setWorkData(res.data || []);
        calculateStats(res.data || []);
      } else {
        showToast("Gagal memuat data pekerjaan", "error");
      }
    } catch (error) {
      showToast("Error memuat data", "error");
    } finally {
      setCalendarLoading(false);
    }
  };

  const calculateStats = (data: WorkLog[]) => {
    const totalBerkas = data.reduce((sum, item) => sum + (item.berkas || 0), 0);
    const totalBuku = data.reduce((sum, item) => sum + (item.buku || 0), 0);
    const totalBundle = data.reduce((sum, item) => sum + (item.bundle || 0), 0);
    setStats({ totalBerkas, totalBuku, totalBundle });
  };

  const getWorkForDay = (day: number): WorkLog[] => {
    const targetDate = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      day,
    );
    const dateStr = toDateString(targetDate);
    return workData.filter((w) => w.tanggal.split("T")[0] === dateStr);
  };

  const handlePreviousMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() - 1),
    );
  };

  const handleNextMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() + 1),
    );
  };

  const handleDayClick = (day: number) => {
    const dayData = getWorkForDay(day);
    setSelectedDayData(dayData);
  };

  const getWorkCount = (day: number) => {
    return getWorkForDay(day).length;
  };

  const getTotalWorkCount = () => {
    return workData.length;
  };

  const handleFilterChange = (
    type: "harian" | "mingguan" | "bulanan" | "custom",
  ) => {
    setFilterType(type);
    setSelectedDayData([]);
    if (type !== "custom") {
      setIsSelectingDateRange(false);
    }
  };

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDateRangeStart(e.target.value);
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDateRangeEnd(e.target.value);
  };

  const applyCustomDateRange = () => {
    if (dateRangeStart && dateRangeEnd) {
      if (new Date(dateRangeStart) <= new Date(dateRangeEnd)) {
        setIsSelectingDateRange(false);
        // Data will reload with useEffect
      } else {
        showToast("Tanggal awal harus lebih kecil dari tanggal akhir", "error");
      }
    }
  };

  // Date Range Picker Functions
  const handleDatePickerPrevMonth = () => {
    setDatePickerMonth(
      new Date(datePickerMonth.getFullYear(), datePickerMonth.getMonth() - 1),
    );
  };

  const handleDatePickerNextMonth = () => {
    setDatePickerMonth(
      new Date(datePickerMonth.getFullYear(), datePickerMonth.getMonth() + 1),
    );
  };

  const handleCalendarDateClick = (
    year: number,
    month: number,
    day: number,
  ) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    if (isSelectingStart) {
      setTempDateRangeStart(dateStr);
      setTempDateRangeEnd("");
      setIsSelectingStart(false);
    } else {
      if (new Date(dateStr) >= new Date(tempDateRangeStart)) {
        setTempDateRangeEnd(dateStr);
        // Don't auto-close, let user click Terapkan button
      } else {
        showToast(
          "Pilih tanggal akhir yang lebih besar dari tanggal awal",
          "error",
        );
      }
    }
  };

  const isDateInRange = (year: number, month: number, day: number): boolean => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (!tempDateRangeStart) return false;
    // Show range preview even while hovering
    if (!tempDateRangeEnd) return dateStr >= tempDateRangeStart;
    return dateStr >= tempDateRangeStart && dateStr <= tempDateRangeEnd;
  };

  const isDateStartEnd = (
    year: number,
    month: number,
    day: number,
  ): "start" | "end" | null => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (dateStr === tempDateRangeStart) return "start";
    if (dateStr === tempDateRangeEnd) return "end";
    return null;
  };

  const renderCalendarMonth = (offset: number) => {
    const month = new Date(
      datePickerMonth.getFullYear(),
      datePickerMonth.getMonth() + offset,
    );
    const year = month.getFullYear();
    const monthIndex = month.getMonth();
    const getDaysInMonth = () => new Date(year, monthIndex + 1, 0).getDate();
    const getFirstDayOfMonth = () => new Date(year, monthIndex, 1).getDay();

    const monthName = [
      "Januari",
      "Februari",
      "Maret",
      "April",
      "Mei",
      "Juni",
      "Juli",
      "Agustus",
      "September",
      "Oktober",
      "November",
      "Desember",
    ][monthIndex];

    const days = [];
    const firstDay = getFirstDayOfMonth();
    const daysInMonth = getDaysInMonth();

    // Empty cells
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="calendar-cell empty"></div>);
    }

    // Days
    for (let day = 1; day <= daysInMonth; day++) {
      const inRange = isDateInRange(year, monthIndex, day);
      const startEnd = isDateStartEnd(year, monthIndex, day);
      const isStart = startEnd === "start";
      const isEnd = startEnd === "end";

      days.push(
        <div
          key={day}
          className={`calendar-cell ${inRange ? "in-range" : ""} ${isStart ? "start-date" : ""} ${isEnd ? "end-date" : ""}`}
          onClick={() => handleCalendarDateClick(year, monthIndex, day)}
        >
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
          {["S", "M", "T", "W", "T", "F", "S"].map((day) => (
            <div key={day} className="calendar-weekday">
              {day}
            </div>
          ))}
        </div>
        <div className="calendar-days">{days}</div>
      </div>
    );
  };

  const handleExportClick = () => {
    setIsExportModalOpen(true);
    if (filterType === "harian") {
      setExportSelectedDate(toDateString(new Date()));
    } else if (filterType === "custom") {
      setTempExportDateStart(dateRangeStart);
      setTempExportDateEnd(dateRangeEnd);
    }
  };

  const downloadExcelByFilter = async () => {
    try {
      let dataToDownload: WorkLog[] = [];
      let dateRangeStr = "";
      let filename = "";

      if (filterType === "harian") {
        const selectedDate = new Date(exportSelectedDate);
        const dateStr = toDateString(selectedDate);
        dataToDownload = workData.filter(
          (w) => w.tanggal.split("T")[0] === dateStr,
        );
        dateRangeStr = selectedDate.toLocaleDateString("id-ID", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        });
        filename = `Statistik_Pekerjaan_Harian`;
      } else if (filterType === "mingguan") {
        dataToDownload = workData;
        const now = new Date();
        const first = now.getDate() - now.getDay();
        const weekStart = new Date(now.setDate(first));
        const weekEnd = new Date(now.setDate(first + 6));
        dateRangeStr = `${toDateString(weekStart)} sampai ${toDateString(weekEnd)}`;
        filename = `Statistik_Pekerjaan_Mingguan`;
      } else if (filterType === "bulanan") {
        dataToDownload = workData;
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const monthName = [
          "Januari",
          "Februari",
          "Maret",
          "April",
          "Mei",
          "Juni",
          "Juli",
          "Agustus",
          "September",
          "Oktober",
          "November",
          "Desember",
        ][month];
        dateRangeStr = `${monthName} ${year}`;
        filename = `Statistik_Pekerjaan_${monthName}_${year}`;
      } else if (filterType === "custom") {
        if (!tempExportDateStart || !tempExportDateEnd) {
          showToast("Pilih rentang tanggal terlebih dahulu", "error");
          return;
        }
        dataToDownload = workData.filter((w) => {
          const workDate = w.tanggal.split("T")[0];
          return (
            workDate >= tempExportDateStart && workDate <= tempExportDateEnd
          );
        });
        dateRangeStr = `${tempExportDateStart} sampai ${tempExportDateEnd}`;
        filename = `Statistik_Pekerjaan_Custom`;
      }

      if (dataToDownload.length === 0) {
        showToast("Tidak ada data untuk diunduh", "error");
        return;
      }

      const totalBerkas = dataToDownload.reduce(
        (s, w) => s + (w.berkas || 0),
        0,
      );
      const totalBuku = dataToDownload.reduce((s, w) => s + (w.buku || 0), 0);
      const totalBundle = dataToDownload.reduce(
        (s, w) => s + (w.bundle || 0),
        0,
      );

      await exportExcel({
        fileName: filename,
        companyName: "SISMON Magang",
        sheets: [
          {
            sheetName: "Monitoring",
            title: "MONITORING PEKERJAAN",
            subtitle: dateRangeStr,
            infoLines: [
              `Total Data: ${dataToDownload.length} pekerjaan`,
              `Total Berkas: ${totalBerkas} | Buku: ${totalBuku} | Bundle: ${totalBundle}`,
            ],
            columns: [
              { header: "No", key: "no", width: 6, type: "number" },
              { header: "Tanggal", key: "tanggal", width: 22, type: "date" },
              { header: "Job Desk", key: "jenis", width: 20 },
              { header: "Keterangan", key: "keterangan", width: 28 },
              { header: "Berkas", key: "berkas", width: 10, type: "number" },
              { header: "Buku", key: "buku", width: 10, type: "number" },
              { header: "Bundle", key: "bundle", width: 10, type: "number" },
            ],
            data: dataToDownload.map((work, index) => ({
              no: index + 1,
              tanggal: new Date(work.tanggal).toLocaleDateString("id-ID", {
                day: "numeric",
                month: "long",
                year: "numeric",
              }),
              jenis: work.jenis,
              keterangan: work.keterangan || "-",
              berkas: work.berkas || 0,
              buku: work.buku || 0,
              bundle: work.bundle || 0,
            })),
            summaryRow: {
              no: "",
              tanggal: "",
              jenis: "",
              keterangan: "",
              berkas: totalBerkas,
              buku: totalBuku,
              bundle: totalBundle,
            },
            summaryLabel: "TOTAL",
          },
        ],
      });
      showToast("Excel berhasil diunduh!", "success");
      setIsExportModalOpen(false);
    } catch (error) {
      console.error("Error downloading Excel:", error);
      showToast("Gagal mengunduh Excel", "error");
    }
  };

  // Export Date Range Picker Functions
  const handleExportDatePickerPrevMonth = () => {
    setExportDatePickerMonth(
      new Date(
        exportDatePickerMonth.getFullYear(),
        exportDatePickerMonth.getMonth() - 1,
      ),
    );
  };

  const handleExportDatePickerNextMonth = () => {
    setExportDatePickerMonth(
      new Date(
        exportDatePickerMonth.getFullYear(),
        exportDatePickerMonth.getMonth() + 1,
      ),
    );
  };

  const handleExportCalendarDateClick = (
    year: number,
    month: number,
    day: number,
  ) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    if (isExportSelectingStart) {
      setTempExportDateStart(dateStr);
      setTempExportDateEnd("");
      setIsExportSelectingStart(false);
    } else {
      if (new Date(dateStr) >= new Date(tempExportDateStart)) {
        setTempExportDateEnd(dateStr);
      } else {
        showToast(
          "Pilih tanggal akhir yang lebih besar dari tanggal awal",
          "error",
        );
      }
    }
  };

  const isExportDateInRange = (
    year: number,
    month: number,
    day: number,
  ): boolean => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (!tempExportDateStart) return false;
    if (!tempExportDateEnd) return dateStr >= tempExportDateStart;
    return dateStr >= tempExportDateStart && dateStr <= tempExportDateEnd;
  };

  const isExportDateStartEnd = (
    year: number,
    month: number,
    day: number,
  ): "start" | "end" | null => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (dateStr === tempExportDateStart) return "start";
    if (dateStr === tempExportDateEnd) return "end";
    return null;
  };

  const renderExportCalendarMonth = (offset: number) => {
    const month = new Date(
      exportDatePickerMonth.getFullYear(),
      exportDatePickerMonth.getMonth() + offset,
    );
    const year = month.getFullYear();
    const monthIndex = month.getMonth();
    const getDaysInMonth = () => new Date(year, monthIndex + 1, 0).getDate();
    const getFirstDayOfMonth = () => new Date(year, monthIndex, 1).getDay();

    const monthName = [
      "Januari",
      "Februari",
      "Maret",
      "April",
      "Mei",
      "Juni",
      "Juli",
      "Agustus",
      "September",
      "Oktober",
      "November",
      "Desember",
    ][monthIndex];

    const days = [];
    const firstDay = getFirstDayOfMonth();
    const daysInMonth = getDaysInMonth();

    for (let i = 0; i < firstDay; i++) {
      days.push(
        <div key={`empty-${i}`} className="calendar-cell-sm empty"></div>,
      );
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const inRange = isExportDateInRange(year, monthIndex, day);
      const startEnd = isExportDateStartEnd(year, monthIndex, day);
      const isStart = startEnd === "start";
      const isEnd = startEnd === "end";

      days.push(
        <div
          key={day}
          className={`calendar-cell-sm ${inRange ? "in-range" : ""} ${isStart ? "start-date" : ""} ${isEnd ? "end-date" : ""}`}
          onClick={() => handleExportCalendarDateClick(year, monthIndex, day)}
        >
          {day}
        </div>,
      );
    }

    return (
      <div className="calendar-month-picker-sm">
        <div className="calendar-month-header-sm">
          <h4>
            {monthName} {year}
          </h4>
        </div>
        <div className="calendar-weekdays-sm">
          {["S", "M", "T", "W", "T", "F", "S"].map((day) => (
            <div key={day} className="calendar-weekday-sm">
              {day}
            </div>
          ))}
        </div>
        <div className="calendar-days-sm">{days}</div>
      </div>
    );
  };

  const renderExportHarianCalendarMonth = () => {
    const year = exportHarianMonth.getFullYear();
    const monthIndex = exportHarianMonth.getMonth();
    const getDaysInMonth = () => new Date(year, monthIndex + 1, 0).getDate();
    const getFirstDayOfMonth = () => new Date(year, monthIndex, 1).getDay();

    const monthName = [
      "Januari",
      "Februari",
      "Maret",
      "April",
      "Mei",
      "Juni",
      "Juli",
      "Agustus",
      "September",
      "Oktober",
      "November",
      "Desember",
    ][monthIndex];

    // Helper function to check if a date has data
    const hasDataOnDate = (dateStr: string) => {
      return workData.some((w) => w.tanggal.split("T")[0] === dateStr);
    };

    const days = [];
    const firstDay = getFirstDayOfMonth();
    const daysInMonth = getDaysInMonth();

    for (let i = 0; i < firstDay; i++) {
      days.push(
        <div
          key={`empty-${i}`}
          className="export-harian-calendar-cell empty"
        ></div>,
      );
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const isSelected = dateStr === exportSelectedDate;
      const hasData = hasDataOnDate(dateStr);
      const dataCount = workData.filter(
        (w) => w.tanggal.split("T")[0] === dateStr,
      ).length;

      days.push(
        <div
          key={day}
          className={`export-harian-calendar-cell ${isSelected ? "selected" : ""} ${hasData ? "has-data" : ""}`}
          onClick={() => setExportSelectedDate(dateStr)}
          title={hasData ? `${dataCount} pekerjaan` : "Tidak ada data"}
        >
          <div className="cell-day">{day}</div>
          {hasData && (
            <div className="cell-indicator" title={`${dataCount} pekerjaan`}>
              {dataCount}
            </div>
          )}
        </div>,
      );
    }

    return (
      <div className="export-harian-calendar">
        <div className="export-harian-calendar-header">
          <button
            className="export-harian-nav-btn"
            onClick={() => setExportHarianMonth(new Date(year, monthIndex - 1))}
          >
            ←
          </button>
          <h4>
            {monthName} {year}
          </h4>
          <button
            className="export-harian-nav-btn"
            onClick={() => setExportHarianMonth(new Date(year, monthIndex + 1))}
          >
            →
          </button>
        </div>
        <div className="export-harian-weekdays">
          {["S", "M", "T", "W", "T", "F", "S"].map((day) => (
            <div key={day} className="export-harian-weekday">
              {day}
            </div>
          ))}
        </div>
        <div className="export-harian-calendar-days">{days}</div>
      </div>
    );
  };

  const downloadExcel = async () => {
    if (selectedDayData.length === 0 && workData.length === 0) {
      handleExportClick();
      return;
    }

    try {
      const dataToExport =
        selectedDayData.length > 0 ? selectedDayData : workData;
      const selectedDateStr =
        selectedDayData.length > 0
          ? new Date(selectedDayData[0]?.tanggal).toLocaleDateString("id-ID", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })
          : `${dateRangeStart} sampai ${dateRangeEnd}`;

      const totalBerkas = dataToExport.reduce((s, w) => s + (w.berkas || 0), 0);
      const totalBuku = dataToExport.reduce((s, w) => s + (w.buku || 0), 0);
      const totalBundle = dataToExport.reduce((s, w) => s + (w.bundle || 0), 0);

      await exportExcel({
        fileName: "Monitor_Pekerjaan",
        companyName: "SISMON Magang",
        sheets: [
          {
            sheetName: "Monitoring",
            title: "MONITORING PEKERJAAN",
            subtitle: selectedDateStr,
            infoLines: [
              `Total Data: ${dataToExport.length} pekerjaan`,
              `Total Berkas: ${totalBerkas} | Buku: ${totalBuku} | Bundle: ${totalBundle}`,
            ],
            columns: [
              { header: "No", key: "no", width: 6, type: "number" },
              { header: "Tanggal", key: "tanggal", width: 22, type: "date" },
              { header: "Job Desk", key: "jenis", width: 20 },
              { header: "Keterangan", key: "keterangan", width: 28 },
              { header: "Berkas", key: "berkas", width: 10, type: "number" },
              { header: "Buku", key: "buku", width: 10, type: "number" },
              { header: "Bundle", key: "bundle", width: 10, type: "number" },
            ],
            data: dataToExport.map((work, index) => ({
              no: index + 1,
              tanggal: new Date(work.tanggal).toLocaleDateString("id-ID", {
                day: "numeric",
                month: "long",
                year: "numeric",
              }),
              jenis: work.jenis,
              keterangan: work.keterangan || "-",
              berkas: work.berkas || 0,
              buku: work.buku || 0,
              bundle: work.bundle || 0,
            })),
            summaryRow: {
              no: "",
              tanggal: "",
              jenis: "",
              keterangan: "",
              berkas: totalBerkas,
              buku: totalBuku,
              bundle: totalBundle,
            },
            summaryLabel: "TOTAL",
          },
        ],
      });
      showToast("Excel berhasil diunduh!", "success");
    } catch (error) {
      console.error("Error downloading Excel:", error);
      showToast("Gagal mengunduh Excel", "error");
    }
  };

  // Effect to manage modal backdrop blur
  useEffect(() => {
    const app = document.querySelector(".app-wrapper");
    if (isExportModalOpen) {
      document.body.style.overflow = "hidden";
      if (app) app.classList.add("paused");
    } else {
      document.body.style.overflow = "unset";
      if (app) app.classList.remove("paused");
    }

    return () => {
      document.body.style.overflow = "unset";
      if (app) app.classList.remove("paused");
    };
  }, [isExportModalOpen]);

  // Effect to manage body scroll for mobile date picker
  useEffect(() => {
    // Only apply on mobile/tablet
    if (window.innerWidth <= 768) {
      if (isSelectingDateRange) {
        document.body.style.overflow = "hidden";
      } else {
        document.body.style.overflow = "unset";
      }
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isSelectingDateRange]);

  useEffect(() => {
    loadWorkData();
  }, [filterType, dateRangeStart, dateRangeEnd, currentDate]);

  const today = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const monthYear = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ][currentDate.getMonth()];

  // State for mobile check
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <>
      <div className="page-header">
        <h1>Statistik Pekerjaan</h1>
        <p>Monitor statistik pekerjaan harian, mingguan, atau bulanan</p>
      </div>

      {/* Filter Bar */}
      <div className="work-filter-bar">
        <div className="filter-buttons">
          <button
            className={`filter-btn ${filterType === "harian" ? "active" : ""}`}
            onClick={() => handleFilterChange("harian")}
          >
            Today
          </button>
          <button
            className={`filter-btn ${filterType === "mingguan" ? "active" : ""}`}
            onClick={() => handleFilterChange("mingguan")}
          >
            Weekly
          </button>
          <button
            className={`filter-btn ${filterType === "bulanan" ? "active" : ""}`}
            onClick={() => handleFilterChange("bulanan")}
          >
            Monthly
          </button>
          <button
            className={`filter-btn ${filterType === "custom" ? "active" : ""}`}
            onClick={() => {
              handleFilterChange("custom");
              if (!isSelectingDateRange) {
                setIsSelectingStart(true);
              }
            }}
          >
            Custom
          </button>
        </div>

        {filterType === "custom" && (
          <div className="custom-date-range-container">
            <button
              className="custom-date-range-toggle"
              onClick={() => setIsSelectingDateRange(!isSelectingDateRange)}
            >
              {tempDateRangeStart && tempDateRangeEnd
                ? `${tempDateRangeStart} - ${tempDateRangeEnd}`
                : dateRangeStart && dateRangeEnd
                  ? `${dateRangeStart} - ${dateRangeEnd}`
                  : "Pilih rentang tanggal"}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                style={{
                  width: "16px",
                  height: "16px",
                  transform: isSelectingDateRange
                    ? "rotate(180deg)"
                    : "rotate(0deg)",
                  transition: "transform 0.2s",
                }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {isSelectingDateRange && !isMobile && (
              <div className="custom-date-picker-dropdown">
                <div className="custom-date-picker-header">
                  <button
                    className="custom-date-nav-btn"
                    onClick={handleDatePickerPrevMonth}
                  >
                    ←
                  </button>
                  <span>Pilih Rentang Tanggal</span>
                  <button
                    className="custom-date-nav-btn"
                    onClick={handleDatePickerNextMonth}
                  >
                    →
                  </button>
                </div>

                <div className="custom-calendars-container">
                  {renderCalendarMonth(0)}
                  {renderCalendarMonth(1)}
                </div>

                <div className="custom-date-range-info">
                  {tempDateRangeStart && !tempDateRangeEnd && (
                    <p>Pilih tanggal akhir</p>
                  )}
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
                        setDateRangeStart(tempDateRangeStart);
                        setDateRangeEnd(tempDateRangeEnd);
                        setIsSelectingDateRange(false);
                        setIsSelectingStart(true);
                      } else {
                        showToast(
                          "Pilih tanggal awal dan akhir terlebih dahulu",
                          "error",
                        );
                      }
                    }}
                  >
                    Terapkan
                  </button>
                  <button
                    className="custom-date-cancel-btn"
                    onClick={() => {
                      setIsSelectingDateRange(false);
                      setTempDateRangeStart("");
                      setTempDateRangeEnd("");
                      setIsSelectingStart(true);
                    }}
                  >
                    Batal
                  </button>
                </div>
              </div>
            )}

            {isSelectingDateRange &&
              isMobile &&
              ReactDOM.createPortal(
                <div
                  className="mobile-date-picker-overlay"
                  onClick={(e) => {
                    if (e.target === e.currentTarget)
                      setIsSelectingDateRange(false);
                  }}
                >
                  <div className="custom-date-picker-dropdown mobile-portal">
                    <div className="custom-date-picker-header">
                      <button
                        className="custom-date-nav-btn"
                        onClick={handleDatePickerPrevMonth}
                      >
                        ←
                      </button>
                      <span>Pilih Rentang Tanggal</span>
                      <button
                        className="custom-date-nav-btn"
                        onClick={handleDatePickerNextMonth}
                      >
                        →
                      </button>
                    </div>

                    <div className="custom-calendars-container">
                      {renderCalendarMonth(0)}
                      {renderCalendarMonth(1)}
                    </div>

                    <div className="custom-date-range-info">
                      {tempDateRangeStart && !tempDateRangeEnd && (
                        <p>Pilih tanggal akhir</p>
                      )}
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
                            setDateRangeStart(tempDateRangeStart);
                            setDateRangeEnd(tempDateRangeEnd);
                            setIsSelectingDateRange(false);
                            setIsSelectingStart(true);
                          } else {
                            showToast(
                              "Pilih tanggal awal dan akhir terlebih dahulu",
                              "error",
                            );
                          }
                        }}
                      >
                        Terapkan
                      </button>
                      <button
                        className="custom-date-cancel-btn"
                        onClick={() => {
                          setIsSelectingDateRange(false);
                          setTempDateRangeStart("");
                          setTempDateRangeEnd("");
                          setIsSelectingStart(true);
                        }}
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                </div>,
                document.body,
              )}
          </div>
        )}
      </div>

      <div className="work-monitor-layout">
        <div className="calendar-card">
          <div className="calendar-header">
            <button className="calendar-nav-btn" onClick={handlePreviousMonth}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </button>
            <h2 className="calendar-title">
              {monthYear} {currentDate.getFullYear()}
            </h2>
            <button className="calendar-nav-btn" onClick={handleNextMonth}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          </div>

          <div className="calendar-day-names">
            {["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"].map((day) => (
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
              const count = getWorkCount(day);
              const targetDate = toDateString(
                new Date(
                  currentDate.getFullYear(),
                  currentDate.getMonth(),
                  day,
                ),
              );
              const isSelected =
                selectedDayData.length > 0 &&
                selectedDayData[0]?.tanggal.split("T")[0] === targetDate;
              return (
                <div
                  key={day}
                  className={`calendar-day ${count > 0 ? "has-data" : ""} ${isSelected ? "selected" : ""}`}
                  onClick={() => handleDayClick(day)}
                  title={`${count} entri pekerjaan`}
                >
                  <div className="day-number">{day}</div>
                  {count > 0 && <div className="day-badge">{count}</div>}
                </div>
              );
            })}
          </div>
        </div>

        <div className="work-details">
          <div className="details-header">
            <h3>Detail Pekerjaan</h3>
            {(selectedDayData.length > 0 || workData.length > 0) && (
              <button
                onClick={handleExportClick}
                title="Download Excel"
                style={{
                  padding: "6px 12px",
                  background:
                    "linear-gradient(135deg, var(--accent-green), #059669)",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: "600",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  style={{ width: "14px", height: "14px" }}
                >
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
              <p>Pilih tanggal untuk melihat detail pekerjaan</p>
            </div>
          ) : (
            <div className="details-content">
              <div className="day-info">
                <h4>
                  {new Date(selectedDayData[0]?.tanggal).toLocaleDateString(
                    "id-ID",
                    {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    },
                  )}
                </h4>
                <p>{selectedDayData.length} entri pekerjaan</p>
              </div>

              <div className="work-table-wrapper">
                <table className="work-table">
                  <thead>
                    <tr>
                      <th>No</th>
                      <th>Job Desk</th>
                      <th>Keterangan</th>
                      <th>Berkas</th>
                      <th>Buku</th>
                      <th>Bundle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedDayData.map((work, i) => (
                      <tr key={work._id}>
                        <td>{i + 1}</td>
                        <td className="job-cell">{work.jenis}</td>
                        <td className="desc-cell">{work.keterangan || "-"}</td>
                        <td className="number-cell">{work.berkas}</td>
                        <td className="number-cell">{work.buku}</td>
                        <td className="number-cell">{work.bundle}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="day-summary">
                <div className="summary-item">
                  <span className="summary-label">Total Berkas:</span>
                  <span className="summary-value">
                    {selectedDayData.reduce(
                      (sum, item) => sum + (item.berkas || 0),
                      0,
                    )}
                  </span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Total Buku:</span>
                  <span className="summary-value">
                    {selectedDayData.reduce(
                      (sum, item) => sum + (item.buku || 0),
                      0,
                    )}
                  </span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Total Bundle:</span>
                  <span className="summary-value">
                    {selectedDayData.reduce(
                      (sum, item) => sum + (item.bundle || 0),
                      0,
                    )}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="overall-stats">
            <div className="stat-card">
              <div className="stat-label">Total Berkas</div>
              <div className="stat-value">{stats.totalBerkas}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total Buku</div>
              <div className="stat-value">{stats.totalBuku}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total Bundle</div>
              <div className="stat-value">{stats.totalBundle}</div>
            </div>
          </div>

          <div className="total-arsip-card">
            <div className="total-arsip-label">
              TOTAL ARSIP YANG TELAH DI INPUT
            </div>
            <div className="total-arsip-value">
              {stats.totalBerkas + stats.totalBuku + stats.totalBundle}
            </div>
          </div>
        </div>
      </div>

      {/* Export Modal */}
      {isExportModalOpen &&
        ReactDOM.createPortal(
          <div className="modal-overlay active">
            <div className="modal-card export-modal-card">
              <div className="modal-header">
                <h3>Unduh Data Pekerjaan</h3>
                <div
                  className="modal-close"
                  onClick={() => setIsExportModalOpen(false)}
                >
                  ✕
                </div>
              </div>

              <div className="modal-body">
                {filterType === "harian" && (
                  <div className="export-harian-section">
                    <p className="export-modal-label">
                      Select a date to download:
                    </p>
                    {renderExportHarianCalendarMonth()}
                    <p className="export-modal-info">
                      Total data:{" "}
                      {
                        workData.filter(
                          (w) => w.tanggal.split("T")[0] === exportSelectedDate,
                        ).length
                      }{" "}
                      pekerjaan
                    </p>
                  </div>
                )}

                {filterType === "mingguan" && (
                  <div className="export-mingguan-section">
                    <p className="export-modal-label">
                      Download this week's data?
                    </p>
                    <p className="export-modal-info">
                      {(() => {
                        const now = new Date();
                        const first = now.getDate() - now.getDay();
                        const weekStart = new Date(now.setDate(first));
                        const weekEnd = new Date(
                          new Date(now.setDate(first + 6)),
                        );
                        return `${toDateString(weekStart)} sampai ${toDateString(weekEnd)}`;
                      })()}
                    </p>
                    <p className="export-modal-info">
                      Total data: {workData.length} pekerjaan
                    </p>
                  </div>
                )}

                {filterType === "bulanan" && (
                  <div className="export-bulanan-section">
                    <p className="export-modal-label">
                      Download this month's data?
                    </p>
                    <p className="export-modal-info">
                      {(() => {
                        const monthName = [
                          "Januari",
                          "Februari",
                          "Maret",
                          "April",
                          "Mei",
                          "Juni",
                          "Juli",
                          "Agustus",
                          "September",
                          "Oktober",
                          "November",
                          "Desember",
                        ][currentDate.getMonth()];
                        return `${monthName} ${currentDate.getFullYear()}`;
                      })()}
                    </p>
                    <p className="export-modal-info">
                      Total data: {workData.length} pekerjaan
                    </p>
                  </div>
                )}

                {filterType === "custom" && (
                  <div className="export-custom-section">
                    <p className="export-modal-label">
                      Select a date range to download:
                    </p>
                    <button
                      className="export-date-range-toggle"
                      onClick={() =>
                        setIsExportDateRangeOpen(!isExportDateRangeOpen)
                      }
                    >
                      {tempExportDateStart && tempExportDateEnd
                        ? `${tempExportDateStart} - ${tempExportDateEnd}`
                        : "Pilih tanggal"}
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        style={{
                          width: "16px",
                          height: "16px",
                          transform: isExportDateRangeOpen
                            ? "rotate(180deg)"
                            : "rotate(0deg)",
                          transition: "transform 0.2s",
                        }}
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>

                    {isExportDateRangeOpen && (
                      <div className="export-date-picker-dropdown">
                        <div className="export-date-picker-header">
                          <button
                            className="export-date-nav-btn"
                            onClick={handleExportDatePickerPrevMonth}
                          >
                            ←
                          </button>
                          <span>Pilih Rentang Tanggal</span>
                          <button
                            className="export-date-nav-btn"
                            onClick={handleExportDatePickerNextMonth}
                          >
                            →
                          </button>
                        </div>

                        <div className="export-calendars-container">
                          {renderExportCalendarMonth(0)}
                          {renderExportCalendarMonth(1)}
                        </div>

                        <div className="export-date-range-info">
                          {tempExportDateStart && !tempExportDateEnd && (
                            <p>Pilih tanggal akhir</p>
                          )}
                          {tempExportDateStart && tempExportDateEnd && (
                            <p>
                              {tempExportDateStart} sampai {tempExportDateEnd}
                            </p>
                          )}
                        </div>

                        <button
                          className="export-date-apply-btn"
                          onClick={() => {
                            if (tempExportDateStart && tempExportDateEnd) {
                              setExportDateRangeStart(tempExportDateStart);
                              setExportDateRangeEnd(tempExportDateEnd);
                              setIsExportDateRangeOpen(false);
                            } else {
                              showToast(
                                "Pilih rentang tanggal terlebih dahulu",
                                "error",
                              );
                            }
                          }}
                        >
                          Terapkan
                        </button>
                      </div>
                    )}

                    {exportDateRangeStart && exportDateRangeEnd && (
                      <p className="export-modal-info">
                        Total data:{" "}
                        {
                          workData.filter((w) => {
                            const wDate = w.tanggal.split("T")[0];
                            return (
                              wDate >= exportDateRangeStart &&
                              wDate <= exportDateRangeEnd
                            );
                          }).length
                        }{" "}
                        pekerjaan
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button
                  className="btn-outline"
                  onClick={() => setIsExportModalOpen(false)}
                >
                  Batal
                </button>
                <button
                  className="btn btn-primary"
                  onClick={downloadExcelByFilter}
                >
                  Unduh Excel
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
};

export default MonitoringPekerjaan;
