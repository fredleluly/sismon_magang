import React, { useEffect, useState, useRef } from "react";
import ReactDOM from "react-dom";
import { Chart, registerables } from "chart.js";
import { DashboardAPI, WorkLogAPI } from "../../services/api";
import { useToast } from "../../context/ToastContext";
import type {
  UserDashboard,
  WorkLog,
  WeeklyProgress,
  WorkDistribution,
} from "../../types";
import { exportExcel } from '../../utils/excelExport';

Chart.register(...registerables);

interface JobDeskRecap {
  jobDesk: string;
  berkas: number;
  buku: number;
  bundle: number;
  total: number;
}

const JOB_COLORS: Record<string, string> = {
  Sortir: "#4db8e8",
  Register: "#0a6599",
  "Pencopotan Steples": "#8b5cf6",
  Scanning: "#22c55e",
  Rekardus: "#fb923c",
  Stikering: "#ffd600",
  "Sortir Dokumen": "#4db8e8",
  Registering: "#0a6599",
  "Melepas Step": "#8b5cf6",
  "Melakukan Scanning": "#22c55e",
  "Menginput data arsipan (Registering)": "#0a6599",
  "Menyusun arsip kedalam kardus": "#fb923c",
  "Menyusun ke Kardus": "#fb923c",
  Lainnya: "#94a3b8",
};

function animateCounter(el: HTMLElement | null, target: number) {
  if (!el) return;
  const duration = 1000;
  const start = parseInt(el.textContent || "0") || 0;
  const diff = target - start;
  const startTime = performance.now();
  function tick(now: number) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el!.textContent = Math.round(start + diff * eased).toLocaleString();
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

const Dashboard: React.FC = () => {
  const { showToast } = useToast();
  const [data, setData] = useState<UserDashboard | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());

  // Dashboard filter states
  const [dashboardFilterType, setDashboardFilterType] = useState<
    "bulanan" | "custom"
  >("bulanan");
  const [dashboardDateRangeStart, setDashboardDateRangeStart] =
    useState<string>("");
  const [dashboardDateRangeEnd, setDashboardDateRangeEnd] =
    useState<string>("");
  const [isDashboardSelectingDateRange, setIsDashboardSelectingDateRange] =
    useState(false);
  const [dashboardDatePickerMonth, setDashboardDatePickerMonth] = useState(
    new Date(),
  );
  const [dashboardTempDateRangeStart, setDashboardTempDateRangeStart] =
    useState<string>("");
  const [dashboardTempDateRangeEnd, setDashboardTempDateRangeEnd] =
    useState<string>("");
  const [dashboardIsSelectingStart, setDashboardIsSelectingStart] =
    useState(true);

  // Recap filter states
  const [recapFilterType, setRecapFilterType] = useState<"bulanan" | "custom">(
    "bulanan",
  );
  const [recapDateRangeStart, setRecapDateRangeStart] = useState<string>("");
  const [recapDateRangeEnd, setRecapDateRangeEnd] = useState<string>("");
  const [isSelectingDateRange, setIsSelectingDateRange] = useState(false);
  const [datePickerMonth, setDatePickerMonth] = useState(new Date());
  const [tempDateRangeStart, setTempDateRangeStart] = useState<string>("");
  const [tempDateRangeEnd, setTempDateRangeEnd] = useState<string>("");
  const [isSelectingStart, setIsSelectingStart] = useState(true);
  const [recapWorkData, setRecapWorkData] = useState<WorkLog[]>([]);
  const [recapData, setRecapData] = useState<JobDeskRecap[]>([]);
  const weeklyRef = useRef<HTMLCanvasElement>(null);
  const donutRef = useRef<HTMLCanvasElement>(null);
  const weeklyChart = useRef<Chart | null>(null);
  const donutChart = useRef<Chart | null>(null);
  const berkasRef = useRef<HTMLDivElement>(null);
  const bukuRef = useRef<HTMLDivElement>(null);
  const bundleRef = useRef<HTMLDivElement>(null);

  // Percentage change states
  const [percentChange, setPercentChange] = useState<{
    berkas: number | null;
    buku: number | null;
    bundle: number | null;
  }>({ berkas: null, buku: null, bundle: null });

  // Recap helper functions
  const toDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Dashboard date range
  const getDashboardDateRange = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    if (dashboardFilterType === "bulanan") {
      const startOfMonth = new Date(year, month, 1);
      const endOfMonth = new Date(year, month + 1, 0);
      return { from: toDateString(startOfMonth), to: toDateString(endOfMonth) };
    } else if (
      dashboardFilterType === "custom" &&
      dashboardDateRangeStart &&
      dashboardDateRangeEnd
    ) {
      return { from: dashboardDateRangeStart, to: dashboardDateRangeEnd };
    }
    return { from: "", to: "" };
  };

  const handleDashboardDatePickerPrevMonth = () => {
    setDashboardDatePickerMonth(
      new Date(
        dashboardDatePickerMonth.getFullYear(),
        dashboardDatePickerMonth.getMonth() - 1,
      ),
    );
  };

  const handleDashboardDatePickerNextMonth = () => {
    setDashboardDatePickerMonth(
      new Date(
        dashboardDatePickerMonth.getFullYear(),
        dashboardDatePickerMonth.getMonth() + 1,
      ),
    );
  };

  const handleDashboardCalendarDateClick = (
    year: number,
    month: number,
    day: number,
  ) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    if (dashboardIsSelectingStart) {
      setDashboardTempDateRangeStart(dateStr);
      setDashboardTempDateRangeEnd("");
      setDashboardIsSelectingStart(false);
    } else {
      if (new Date(dateStr) >= new Date(dashboardTempDateRangeStart)) {
        setDashboardTempDateRangeEnd(dateStr);
      } else {
        showToast(
          "Pilih tanggal akhir yang lebih besar dari tanggal awal",
          "error",
        );
      }
    }
  };

  const isDashboardDateInRange = (
    year: number,
    month: number,
    day: number,
  ): boolean => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (!dashboardTempDateRangeStart) return false;
    if (!dashboardTempDateRangeEnd)
      return dateStr >= dashboardTempDateRangeStart;
    return (
      dateStr >= dashboardTempDateRangeStart &&
      dateStr <= dashboardTempDateRangeEnd
    );
  };

  const isDashboardDateStartEnd = (
    year: number,
    month: number,
    day: number,
  ): "start" | "end" | null => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (dateStr === dashboardTempDateRangeStart) return "start";
    if (dateStr === dashboardTempDateRangeEnd) return "end";
    return null;
  };

  const renderDashboardCalendarMonth = (offset: number) => {
    const month = new Date(
      dashboardDatePickerMonth.getFullYear(),
      dashboardDatePickerMonth.getMonth() + offset,
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
        <div
          key={`empty-${i}`}
          style={{ width: "30px", height: "30px" }}
        ></div>,
      );
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const inRange = isDashboardDateInRange(year, monthIndex, day);
      const startEnd = isDashboardDateStartEnd(year, monthIndex, day);
      const isStart = startEnd === "start";
      const isEnd = startEnd === "end";

      let bgColor = "transparent";
      if (isStart || isEnd) {
        bgColor = "#8b5cf6";
      } else if (inRange) {
        bgColor = "#ddd6fe";
      }

      days.push(
        <div
          key={day}
          onClick={() =>
            handleDashboardCalendarDateClick(year, monthIndex, day)
          }
          style={{
            width: "30px",
            height: "30px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: bgColor,
            border: inRange ? "1px solid #8b5cf6" : "1px solid transparent",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "12px",
            fontWeight: inRange ? "600" : "400",
            color: isStart || isEnd ? "white" : "#030712",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            if (!isStart && !isEnd && inRange) {
              (e.currentTarget as HTMLElement).style.background = "#c4b5fd";
            }
          }}
          onMouseLeave={(e) => {
            if (!isStart && !isEnd && inRange) {
              (e.currentTarget as HTMLElement).style.background = "#ddd6fe";
            }
          }}
        >
          {day}
        </div>,
      );
    }

    return (
      <div>
        <div style={{ marginBottom: "8px" }}>
          <h4
            style={{ margin: "0 0 8px 0", fontSize: "12px", fontWeight: "600" }}
          >
            {monthName} {year}
          </h4>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: "2px",
            marginBottom: "12px",
          }}
        >
          {["S", "M", "T", "W", "T", "F", "S"].map((d) => (
            <div
              key={d}
              style={{
                textAlign: "center",
                fontSize: "10px",
                fontWeight: "bold",
                color: "#64748b",
                width: "30px",
              }}
            >
              {d}
            </div>
          ))}
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: "2px",
          }}
        >
          {days}
        </div>
      </div>
    );
  };

  const loadDashboardData = async () => {
    try {
      const range = getDashboardDateRange();
      if (!range.from || !range.to) {
        // Load default data if no date range
        const res = await DashboardAPI.getUser();
        if (res && res.success) {
          setData(res.data);
          // Compute % from weeklyProgress (this week vs last week)
          const wp = res.data.weeklyProgress || [];
          if (wp.length > 0) {
            const now = new Date();
            const thisWeekStart = new Date(now);
            thisWeekStart.setDate(now.getDate() - now.getDay());
            const lastWeekStart = new Date(thisWeekStart);
            lastWeekStart.setDate(lastWeekStart.getDate() - 7);

            let twBerkas = 0, twBuku = 0, twBundle = 0;
            let lwBerkas = 0, lwBuku = 0, lwBundle = 0;

            wp.forEach((d) => {
              const date = new Date(d._id);
              if (date >= thisWeekStart) {
                twBerkas += d.berkas || 0;
                twBuku += d.buku || 0;
                twBundle += d.bundle || 0;
              } else if (date >= lastWeekStart && date < thisWeekStart) {
                lwBerkas += d.berkas || 0;
                lwBuku += d.buku || 0;
                lwBundle += d.bundle || 0;
              }
            });

            setPercentChange({
              berkas: lwBerkas > 0 ? Math.round(((twBerkas - lwBerkas) / lwBerkas) * 100) : (twBerkas > 0 ? 100 : 0),
              buku: lwBuku > 0 ? Math.round(((twBuku - lwBuku) / lwBuku) * 100) : (twBuku > 0 ? 100 : 0),
              bundle: lwBundle > 0 ? Math.round(((twBundle - lwBundle) / lwBundle) * 100) : (twBundle > 0 ? 100 : 0),
            });
          } else {
            setPercentChange({ berkas: 0, buku: 0, bundle: 0 });
          }
        }
        return;
      }

      const res = await WorkLogAPI.getAll(
        `from=${range.from}&to=${range.to}&status=Selesai&limit=1000`,
      );
      if (res && res.success) {
        const works = res.data || [];

        // Aggregate data
        const totalBerkas = works.reduce((sum, w) => sum + (w.berkas || 0), 0);
        const totalBuku = works.reduce((sum, w) => sum + (w.buku || 0), 0);
        const totalBundle = works.reduce((sum, w) => sum + (w.bundle || 0), 0);

        // Group by date for weekly progress
        const dateMap: { [key: string]: any } = {};
        works.forEach((w) => {
          const date = new Date(w.tanggal).toISOString().split("T")[0];
          if (!dateMap[date]) {
            dateMap[date] = {
              _id: date,
              berkas: 0,
              buku: 0,
              bundle: 0,
              count: 0,
            };
          }
          dateMap[date].berkas += w.berkas || 0;
          dateMap[date].buku += w.buku || 0;
          dateMap[date].bundle += w.bundle || 0;
          dateMap[date].count += 1;
        });

        // Group by job type for distribution
        const jobMap: { [key: string]: number } = {};
        works.forEach((w) => {
          jobMap[w.jenis] = (jobMap[w.jenis] || 0) + 1;
        });

        const aggregatedData: UserDashboard = {
          totalBerkas,
          totalBuku,
          totalBundle,
          weeklyProgress: Object.values(dateMap).sort(
            (a, b) => new Date(a._id).getTime() - new Date(b._id).getTime(),
          ),
          workDistribution: Object.entries(jobMap).map(([_id, count]) => ({
            _id,
            count,
          })),
          recentActivity: works,
        };

        setData(aggregatedData);

        // Fetch previous period for % comparison
        const fromDate = new Date(range.from);
        const toDate = new Date(range.to);
        const periodMs = toDate.getTime() - fromDate.getTime();
        const prevFrom = new Date(fromDate.getTime() - periodMs - 86400000);
        const prevTo = new Date(fromDate.getTime() - 86400000);

        try {
          const prevRes = await WorkLogAPI.getAll(
            `from=${toDateString(prevFrom)}&to=${toDateString(prevTo)}&status=Selesai&limit=1000`,
          );
          if (prevRes && prevRes.success) {
            const prevWorks = prevRes.data || [];
            const prevBerkas = prevWorks.reduce((s, w) => s + (w.berkas || 0), 0);
            const prevBuku = prevWorks.reduce((s, w) => s + (w.buku || 0), 0);
            const prevBundle = prevWorks.reduce((s, w) => s + (w.bundle || 0), 0);

            setPercentChange({
              berkas: prevBerkas > 0 ? Math.round(((totalBerkas - prevBerkas) / prevBerkas) * 100) : (totalBerkas > 0 ? 100 : 0),
              buku: prevBuku > 0 ? Math.round(((totalBuku - prevBuku) / prevBuku) * 100) : (totalBuku > 0 ? 100 : 0),
              bundle: prevBundle > 0 ? Math.round(((totalBundle - prevBundle) / prevBundle) * 100) : (totalBundle > 0 ? 100 : 0),
            });
          }
        } catch {
          setPercentChange({ berkas: 0, buku: 0, bundle: 0 });
        }
      }
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    }
  };

  const getRecapDateRange = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    if (recapFilterType === "bulanan") {
      const startOfMonth = new Date(year, month, 1);
      const endOfMonth = new Date(year, month + 1, 0);
      return { from: toDateString(startOfMonth), to: toDateString(endOfMonth) };
    } else if (
      recapFilterType === "custom" &&
      recapDateRangeStart &&
      recapDateRangeEnd
    ) {
      return { from: recapDateRangeStart, to: recapDateRangeEnd };
    }
    return { from: "", to: "" };
  };

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

    for (let i = 0; i < firstDay; i++) {
      days.push(
        <div key={`empty-${i}`} className="recap-calendar-cell empty"></div>,
      );
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const inRange = isDateInRange(year, monthIndex, day);
      const startEnd = isDateStartEnd(year, monthIndex, day);
      const isStart = startEnd === "start";
      const isEnd = startEnd === "end";

      let cellClass = "recap-calendar-cell";
      if (isStart) cellClass += " start-date";
      else if (isEnd) cellClass += " end-date";
      else if (inRange) cellClass += " in-range";

      days.push(
        <div
          key={day}
          className={cellClass}
          onClick={() => handleCalendarDateClick(year, monthIndex, day)}
        >
          {day}
        </div>,
      );
    }

    return (
      <div className="recap-calendar-month">
        <div className="recap-calendar-header">
          <h4>
            {monthName} {year}
          </h4>
        </div>
        <div className="recap-calendar-weekdays">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <div key={i} className="recap-calendar-weekday">
              {d}
            </div>
          ))}
        </div>
        <div className="recap-calendar-days">{days}</div>
      </div>
    );
  };

  const loadRecapWorkData = async () => {
    try {
      const range = getRecapDateRange();
      if (!range.from || !range.to) return;

      const res = await WorkLogAPI.getAll(
        `from=${range.from}&to=${range.to}&status=Selesai&limit=1000`,
      );
      if (res && res.success) {
        setRecapWorkData(res.data || []);
        generateRecap(res.data || []);
      }
    } catch (error) {
      console.error("Error loading recap data:", error);
    }
  };

  const generateRecap = (workList: WorkLog[]) => {
    const recapMap: { [key: string]: JobDeskRecap } = {};

    workList.forEach((work) => {
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
      recapMap[jobDesk].total =
        recapMap[jobDesk].berkas +
        recapMap[jobDesk].buku +
        recapMap[jobDesk].bundle;
    });

    const sorted = Object.values(recapMap).sort((a, b) =>
      a.jobDesk.localeCompare(b.jobDesk),
    );
    setRecapData(sorted);
  };

  const downloadRecapExcel = async () => {
    try {
      let dateRangeStr = "";
      let filename = "";

      if (recapFilterType === "bulanan") {
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
        dateRangeStr = `${monthName} ${currentDate.getFullYear()}`;
        filename = `Recap-Pekerjaan-${monthName}-${currentDate.getFullYear()}`;
      } else if (recapFilterType === "custom") {
        if (!recapDateRangeStart || !recapDateRangeEnd) {
          showToast("Pilih rentang tanggal terlebih dahulu", "error");
          return;
        }
        dateRangeStr = `${recapDateRangeStart} sampai ${recapDateRangeEnd}`;
        filename = `Recap-Pekerjaan-${recapDateRangeStart}-sampai-${recapDateRangeEnd}`;
      }

      if (recapData.length === 0) {
        showToast("Tidak ada data untuk diunduh", "error");
        return;
      }

      const totalBerkas = recapData.reduce((sum, item) => sum + item.berkas, 0);
      const totalBuku = recapData.reduce((sum, item) => sum + item.buku, 0);
      const totalBundle = recapData.reduce((sum, item) => sum + item.bundle, 0);
      const grandTotal = totalBerkas + totalBuku + totalBundle;

      await exportExcel({
        fileName: filename,
        companyName: 'SISMON Magang',
        sheets: [{
          sheetName: 'Recap',
          title: 'RECAP PEKERJAAN',
          subtitle: dateRangeStr,
          infoLines: [
            `Total Job Desk: ${recapData.length} jenis`,
            `Grand Total: ${grandTotal} item`,
          ],
          columns: [
            { header: 'No', key: 'no', width: 6, type: 'number' },
            { header: 'Job Desk', key: 'jobDesk', width: 22 },
            { header: 'Berkas', key: 'berkas', width: 12, type: 'number' },
            { header: 'Buku', key: 'buku', width: 12, type: 'number' },
            { header: 'Bundle', key: 'bundle', width: 12, type: 'number' },
            { header: 'Total', key: 'total', width: 12, type: 'number' },
          ],
          data: recapData.map((recap, index) => ({
            no: index + 1,
            jobDesk: recap.jobDesk,
            berkas: recap.berkas,
            buku: recap.buku,
            bundle: recap.bundle,
            total: recap.total,
          })),
          summaryRow: {
            no: '',
            jobDesk: '',
            berkas: totalBerkas,
            buku: totalBuku,
            bundle: totalBundle,
            total: grandTotal,
          },
          summaryLabel: 'TOTAL',
        }],
      });
      showToast("Excel berhasil diunduh!", "success");
    } catch (error) {
      console.error("Error downloading Excel:", error);
      showToast("Gagal mengunduh Excel", "error");
    }
  };

  useEffect(() => {
    loadDashboardData();
    loadRecapWorkData();
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [
    dashboardFilterType,
    dashboardDateRangeStart,
    dashboardDateRangeEnd,
    currentDate,
  ]);

  useEffect(() => {
    loadRecapWorkData();
  }, [recapFilterType, recapDateRangeStart, recapDateRangeEnd, currentDate]);

  useEffect(() => {
    if (!data) return;
    animateCounter(berkasRef.current, data.totalBerkas || 0);
    animateCounter(bukuRef.current, data.totalBuku || 0);
    animateCounter(bundleRef.current, data.totalBundle || 0);

    // Weekly Chart
    if (weeklyRef.current) {
      if (weeklyChart.current) weeklyChart.current.destroy();
      const wp = data.weeklyProgress || [];
      const labels = wp.map((w) => {
        const d = new Date(w._id);
        return d.toLocaleDateString("id-ID", {
          day: "numeric",
          month: "short",
        });
      });

      weeklyChart.current = new Chart(weeklyRef.current, {
        type: "line",
        data: {
          labels: labels.length ? labels : ["1", "2", "3", "4", "5"],
          datasets: [
            {
              label: "Berkas",
              data: wp.map((w) => w.berkas || 0),
              borderColor: "#4db8e8",
              backgroundColor: "rgba(77, 184, 232, 0.1)",
              borderWidth: 2.5,
              pointRadius: 4,
              pointBackgroundColor: "#4db8e8",
              pointBorderColor: "#fff",
              pointBorderWidth: 2,
              pointHoverRadius: 6,
              tension: 0.4,
              fill: false,
            },
            {
              label: "Buku",
              data: wp.map((w) => w.buku || 0),
              borderColor: "#ffd600",
              backgroundColor: "rgba(255, 214, 0, 0.1)",
              borderWidth: 2.5,
              pointRadius: 4,
              pointBackgroundColor: "#ffd600",
              pointBorderColor: "#fff",
              pointBorderWidth: 2,
              pointHoverRadius: 6,
              tension: 0.4,
              fill: false,
            },
            {
              label: "Bundle",
              data: wp.map((w) => w.bundle || 0),
              borderColor: "#22c55e",
              backgroundColor: "rgba(34, 197, 94, 0.1)",
              borderWidth: 2.5,
              pointRadius: 4,
              pointBackgroundColor: "#22c55e",
              pointBorderColor: "#fff",
              pointBorderWidth: 2,
              pointHoverRadius: 6,
              tension: 0.4,
              fill: false,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          clip: false,
          plugins: {
            legend: {
              display: true,
              position: "bottom" as const,
              labels: {
                color: "#64748b",
                font: { size: 12, weight: "bold" as const },
                usePointStyle: true,
                pointStyle: "circle",
                boxWidth: 8,
                padding: 12,
              },
            },
            tooltip: {
              enabled: true,
              backgroundColor: "rgba(15, 23, 42, 0.9)",
              titleColor: "#fff",
              bodyColor: "#e2e8f0",
              borderColor: "#475569",
              borderWidth: 1,
              cornerRadius: 6,
              padding: 10,
              displayColors: true,
            },
          },
          scales: {
            x: {
              offset: false,
              grid: { display: false },
              ticks: {
                color: "#94a3b8",
                font: { size: 11, weight: "normal" as const },
              },
            },
            y: {
              grid: { color: "rgba(226,232,240,0.3)" },
              ticks: { color: "#94a3b8", font: { size: 10 } },
              beginAtZero: true,
            },
          },
        },
      });
    }

    // Donut Chart
    if (donutRef.current) {
      if (donutChart.current) donutChart.current.destroy();
      const wd = data.workDistribution || [];
      const labels = wd.map((w) => w._id || "Lainnya");
      const vals = wd.map((w) => w.count || 0);
      const colors = labels.map((l) => JOB_COLORS[l] || "#94a3b8");
      donutChart.current = new Chart(donutRef.current, {
        type: "doughnut",
        data: {
          labels: labels.length ? labels : ["Belum ada data"],
          datasets: [
            {
              data: vals.length ? vals : [1],
              backgroundColor: vals.length ? colors : ["#e2e8f0"],
              borderWidth: 3,
              borderColor: "#fff",
              hoverOffset: 8,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: "65%",
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: "#fff",
              titleColor: "#1e293b",
              bodyColor: "#64748b",
              borderColor: "#e2e8f0",
              borderWidth: 1,
              cornerRadius: 10,
              padding: 12,
            },
          },
        },
      });
    }

    return () => {
      weeklyChart.current?.destroy();
      donutChart.current?.destroy();
    };
  }, [data]);

  const wd = data?.workDistribution || [];
  const donutLabels = wd.map((w) => w._id || "Lainnya");
  const donutColors = donutLabels.map((l) => JOB_COLORS[l] || "#94a3b8");

  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
        }}
      >
        <div className="page-header">
          <h1>Dashboard</h1>
        </div>

        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <div style={{ display: "flex", gap: "4px" }}>
            <button
              onClick={() => {
                setDashboardFilterType("bulanan");
                setIsDashboardSelectingDateRange(false);
              }}
              style={{
                padding: "6px 12px",
                background:
                  dashboardFilterType === "bulanan" ? "#0a6599" : "#e2e8f0",
                color: dashboardFilterType === "bulanan" ? "white" : "#64748b",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: "600",
                transition: "all 0.3s",
              }}
            >
              Monthly
            </button>
            <button
              onClick={() => {
                setDashboardFilterType("custom");
                if (!isDashboardSelectingDateRange) {
                  setDashboardIsSelectingStart(true);
                }
              }}
              style={{
                padding: "6px 12px",
                background:
                  dashboardFilterType === "custom" ? "#0a6599" : "#e2e8f0",
                color: dashboardFilterType === "custom" ? "white" : "#64748b",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: "600",
                transition: "all 0.3s",
              }}
            >
              Custom
            </button>
          </div>

          {dashboardFilterType === "custom" && (
            <div>
              <button
                onClick={() =>
                  setIsDashboardSelectingDateRange(
                    !isDashboardSelectingDateRange,
                  )
                }
                style={{
                  padding: "6px 12px",
                  background: "#e2e8f0",
                  color: "#64748b",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: "600",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                {dashboardTempDateRangeStart && dashboardTempDateRangeEnd
                  ? `${dashboardTempDateRangeStart} - ${dashboardTempDateRangeEnd}`
                  : dashboardDateRangeStart && dashboardDateRangeEnd
                    ? `${dashboardDateRangeStart} - ${dashboardDateRangeEnd}`
                    : "Select date range"}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  style={{
                    width: "14px",
                    height: "14px",
                    transform: isDashboardSelectingDateRange
                      ? "rotate(180deg)"
                      : "rotate(0deg)",
                    transition: "transform 0.2s",
                  }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {isDashboardSelectingDateRange &&
                ReactDOM.createPortal(
                  <>
                    <div
                      className="recap-date-modal-overlay"
                      onClick={() => setIsDashboardSelectingDateRange(false)}
                    />
                    <div className="recap-date-modal">
                      <div className="recap-date-modal-header">
                        <button onClick={handleDashboardDatePickerPrevMonth}>
                          ←
                        </button>
                        <span>Select Date Range</span>
                        <button onClick={handleDashboardDatePickerNextMonth}>
                          →
                        </button>
                      </div>

                      <div className="recap-calendars-grid">
                        {renderDashboardCalendarMonth(0)}
                        {renderDashboardCalendarMonth(1)}
                      </div>

                      <div className="recap-date-info">
                        {dashboardTempDateRangeStart &&
                          !dashboardTempDateRangeEnd && <p>Select end date</p>}
                        {dashboardTempDateRangeStart &&
                          dashboardTempDateRangeEnd && (
                            <p>
                              {dashboardTempDateRangeStart} to{" "}
                              {dashboardTempDateRangeEnd}
                            </p>
                          )}
                      </div>

                      <div className="recap-date-modal-footer">
                        <button
                          onClick={() => {
                            setIsDashboardSelectingDateRange(false);
                            setDashboardTempDateRangeStart("");
                            setDashboardTempDateRangeEnd("");
                            setDashboardIsSelectingStart(true);
                          }}
                          className="recap-date-cancel-btn"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => {
                            if (
                              dashboardTempDateRangeStart &&
                              dashboardTempDateRangeEnd
                            ) {
                              setDashboardDateRangeStart(
                                dashboardTempDateRangeStart,
                              );
                              setDashboardDateRangeEnd(
                                dashboardTempDateRangeEnd,
                              );
                              setIsDashboardSelectingDateRange(false);
                              setDashboardIsSelectingStart(true);
                            } else {
                              showToast(
                                "Select start and end dates first",
                                "error",
                              );
                            }
                          }}
                          className="recap-date-apply-btn"
                        >
                          Apply
                        </button>
                      </div>
                    </div>
                  </>,
                  document.body,
                )}
            </div>
          )}
        </div>
      </div>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-info">
            <div className="stat-label">Total Berkas</div>
            <div className="stat-value" ref={berkasRef}>
              0
            </div>
            <div className="stat-change" style={{ color: percentChange.berkas !== null && percentChange.berkas < 0 ? 'var(--accent-red)' : 'var(--accent-green)' }}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                style={{ transform: percentChange.berkas !== null && percentChange.berkas < 0 ? 'rotate(180deg)' : 'none' }}
              >
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                <polyline points="17 6 23 6 23 12" />
              </svg>
              <span>
                {percentChange.berkas !== null
                  ? `${percentChange.berkas >= 0 ? '+' : ''}${percentChange.berkas}% dari periode sebelumnya`
                  : 'Memuat...'}
              </span>
            </div>
          </div>
          <div className="stat-icon">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-info">
            <div className="stat-label">Total Buku</div>
            <div className="stat-value" ref={bukuRef}>
              0
            </div>
            <div className="stat-change" style={{ color: percentChange.buku !== null && percentChange.buku < 0 ? 'var(--accent-red)' : 'var(--accent-green)' }}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                style={{ transform: percentChange.buku !== null && percentChange.buku < 0 ? 'rotate(180deg)' : 'none' }}
              >
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                <polyline points="17 6 23 6 23 12" />
              </svg>
              <span>
                {percentChange.buku !== null
                  ? `${percentChange.buku >= 0 ? '+' : ''}${percentChange.buku}% dari periode sebelumnya`
                  : 'Memuat...'}
              </span>
            </div>
          </div>
          <div className="stat-icon">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
            </svg>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-info">
            <div className="stat-label">Total Bundle</div>
            <div className="stat-value" ref={bundleRef}>
              0
            </div>
            <div className="stat-change" style={{ color: percentChange.bundle !== null && percentChange.bundle < 0 ? 'var(--accent-red)' : 'var(--accent-green)' }}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                style={{ transform: percentChange.bundle !== null && percentChange.bundle < 0 ? 'rotate(180deg)' : 'none' }}
              >
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                <polyline points="17 6 23 6 23 12" />
              </svg>
              <span>
                {percentChange.bundle !== null
                  ? `${percentChange.bundle >= 0 ? '+' : ''}${percentChange.bundle}% dari periode sebelumnya`
                  : 'Memuat...'}
              </span>
            </div>
          </div>
          <div className="stat-icon">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="m7.5 4.27 9 5.15" />
              <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
              <path d="m3.3 7 8.7 5 8.7-5" />
              <path d="M12 22V12" />
            </svg>
          </div>
        </div>
      </div>
      <div className="charts-row">
        <div className="chart-card">
          <div className="chart-header">
            <h3>Progres Kerja</h3>
            <p>Jumlah item yang diproses per hari</p>
          </div>
          <div className="chart-canvas-wrapper">
            <canvas ref={weeklyRef} />
          </div>
        </div>
        <div className="chart-card">
          <div className="chart-header">
            <h3>Distribusi Pekerjaan</h3>
            <p>Rincian jenis pekerjaan</p>
          </div>
          <div className="chart-canvas-wrapper" style={{ height: 220 }}>
            <canvas ref={donutRef} />
          </div>
          <div className="donut-legend">
            {donutLabels.map((l, i) => (
              <div key={l} className="legend-item">
                <span
                  className="legend-dot"
                  style={{ background: donutColors[i] }}
                />
                {l}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="activity-card">
        <div className="activity-header">
          <div>
            <h3>Recap Jobdesk</h3>
            <p>Ringkasan pekerjaan per job desk</p>
          </div>
          {recapData.length > 0 && (
            <div className="recap-jobdesk-filter">
              <div className="recap-filter-buttons">
                <button
                  className={`recap-filter-btn ${recapFilterType === "bulanan" ? "active" : ""}`}
                  onClick={() => {
                    setRecapFilterType("bulanan");
                    setIsSelectingDateRange(false);
                  }}
                >
                  Monthly
                </button>
                <button
                  className={`recap-filter-btn ${recapFilterType === "custom" ? "active" : ""}`}
                  onClick={() => {
                    setRecapFilterType("custom");
                    if (!isSelectingDateRange) {
                      setIsSelectingStart(true);
                    }
                  }}
                >
                  Custom
                </button>
              </div>

              {recapFilterType === "custom" && (
                <div>
                  <button
                    className="recap-date-range-btn"
                    onClick={() =>
                      setIsSelectingDateRange(!isSelectingDateRange)
                    }
                  >
                    {tempDateRangeStart && tempDateRangeEnd
                      ? `${tempDateRangeStart} - ${tempDateRangeEnd}`
                      : recapDateRangeStart && recapDateRangeEnd
                        ? `${recapDateRangeStart} - ${recapDateRangeEnd}`
                        : "Select date range"}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      style={{
                        width: "14px",
                        height: "14px",
                        transform: isSelectingDateRange
                          ? "rotate(180deg)"
                          : "rotate(0deg)",
                        transition: "transform 0.2s",
                      }}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>

                  {isSelectingDateRange &&
                    ReactDOM.createPortal(
                      <>
                        <div
                          className="recap-date-modal-overlay"
                          onClick={() => setIsSelectingDateRange(false)}
                        />
                        <div className="recap-date-modal">
                          <div className="recap-date-modal-header">
                            <button onClick={handleDatePickerPrevMonth}>
                              ←
                            </button>
                            <span>Select Date Range</span>
                            <button onClick={handleDatePickerNextMonth}>
                              →
                            </button>
                          </div>

                          <div className="recap-calendars-grid">
                            {renderCalendarMonth(0)}
                            {renderCalendarMonth(1)}
                          </div>

                          <div className="recap-date-info">
                            {tempDateRangeStart && !tempDateRangeEnd && (
                              <p>Select end date</p>
                            )}
                            {tempDateRangeStart && tempDateRangeEnd && (
                              <p>
                                {tempDateRangeStart} to {tempDateRangeEnd}
                              </p>
                            )}
                          </div>

                          <div className="recap-date-modal-footer">
                            <button
                              className="recap-date-cancel-btn"
                              onClick={() => {
                                setIsSelectingDateRange(false);
                                setTempDateRangeStart("");
                                setTempDateRangeEnd("");
                                setIsSelectingStart(true);
                              }}
                            >
                              Cancel
                            </button>
                            <button
                              className="recap-date-apply-btn"
                              onClick={() => {
                                if (tempDateRangeStart && tempDateRangeEnd) {
                                  setRecapDateRangeStart(tempDateRangeStart);
                                  setRecapDateRangeEnd(tempDateRangeEnd);
                                  setIsSelectingDateRange(false);
                                  setIsSelectingStart(true);
                                } else {
                                  showToast(
                                    "Select start and end dates first",
                                    "error",
                                  );
                                }
                              }}
                            >
                              Apply
                            </button>
                          </div>
                        </div>
                      </>,
                      document.body,
                    )}
                </div>
              )}

              <button className="recap-export-btn" onClick={downloadRecapExcel}>
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
            </div>
          )}
        </div>
        {recapData.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: 40,
              color: "var(--gray-400)",
            }}
          >
            Belum ada data pekerjaan untuk periode ini. Mulai input pekerjaan
            Anda!
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              className="activity-table"
              style={{ width: "100%", borderCollapse: "collapse" }}
            >
              <thead>
                <tr
                  style={{
                    background:
                      "linear-gradient(135deg, #e6f4fa 0%, #f0fdf4 100%)",
                    borderBottom: "2px solid #cbd5e1",
                  }}
                >
                  <th
                    style={{
                      padding: "12px",
                      textAlign: "left",
                      fontWeight: "600",
                    }}
                  >
                    No
                  </th>
                  <th
                    style={{
                      padding: "12px",
                      textAlign: "left",
                      fontWeight: "600",
                    }}
                  >
                    Job Desk
                  </th>
                  <th
                    style={{
                      padding: "12px",
                      textAlign: "right",
                      fontWeight: "600",
                    }}
                  >
                    Berkas
                  </th>
                  <th
                    style={{
                      padding: "12px",
                      textAlign: "right",
                      fontWeight: "600",
                    }}
                  >
                    Buku
                  </th>
                  <th
                    style={{
                      padding: "12px",
                      textAlign: "right",
                      fontWeight: "600",
                    }}
                  >
                    Bundle
                  </th>
                  <th
                    style={{
                      padding: "12px",
                      textAlign: "right",
                      fontWeight: "600",
                    }}
                  >
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {recapData.map((recap, index) => (
                  <tr
                    key={index}
                    style={{
                      borderBottom: "1px solid #e2e8f0",
                      transition: "background 0.2s",
                    }}
                  >
                    <td style={{ padding: "12px", textAlign: "left" }}>
                      {index + 1}
                    </td>
                    <td style={{ padding: "12px", textAlign: "left" }}>
                      {recap.jobDesk}
                    </td>
                    <td
                      style={{
                        padding: "12px",
                        textAlign: "right",
                        color: "#0a6599",
                      }}
                    >
                      {recap.berkas}
                    </td>
                    <td
                      style={{
                        padding: "12px",
                        textAlign: "right",
                        color: "#0a6599",
                      }}
                    >
                      {recap.buku}
                    </td>
                    <td
                      style={{
                        padding: "12px",
                        textAlign: "right",
                        color: "#0a6599",
                      }}
                    >
                      {recap.bundle}
                    </td>
                    <td
                      style={{
                        padding: "12px",
                        textAlign: "right",
                        color: "#0a6599",
                        fontWeight: "600",
                        background: "#f0fdf4",
                      }}
                    >
                      {recap.total}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr
                  style={{
                    background:
                      "linear-gradient(135deg, #e6f4fa 0%, #f0fdf4 100%)",
                    borderTop: "2px solid #cbd5e1",
                    fontWeight: "700",
                  }}
                >
                  <td
                    colSpan={2}
                    style={{ padding: "12px", textAlign: "left" }}
                  >
                    TOTAL
                  </td>
                  <td
                    style={{
                      padding: "12px",
                      textAlign: "right",
                      background: "#e6f4fa",
                      color: "#0a6599",
                    }}
                  >
                    {recapData.reduce((sum, r) => sum + r.berkas, 0)}
                  </td>
                  <td
                    style={{
                      padding: "12px",
                      textAlign: "right",
                      background: "#e6f4fa",
                      color: "#0a6599",
                    }}
                  >
                    {recapData.reduce((sum, r) => sum + r.buku, 0)}
                  </td>
                  <td
                    style={{
                      padding: "12px",
                      textAlign: "right",
                      background: "#e6f4fa",
                      color: "#0a6599",
                    }}
                  >
                    {recapData.reduce((sum, r) => sum + r.bundle, 0)}
                  </td>
                  <td
                    style={{
                      padding: "12px",
                      textAlign: "right",
                      background: "#e6f4fa",
                      color: "#0a6599",
                    }}
                  >
                    {recapData.reduce((sum, r) => sum + r.total, 0)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </>
  );
};

export default Dashboard;
