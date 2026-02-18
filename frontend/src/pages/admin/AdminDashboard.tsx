import React, { useEffect, useState, useRef } from "react";
import { Chart, registerables } from "chart.js";
import { exportExcel } from "../../utils/excelExport";
import {
  DashboardAPI,
  getToken,
  ComplaintAPI,
  PerformanceAPI,
} from "../../services/api";
import { useToast } from "../../context/ToastContext";
import type {
  AdminDashboard as AdminDashData,
  PerformanceEvaluation,
  User,
} from "../../types";
import "./Ranking.css";

Chart.register(...registerables);

function animateCounter(el: HTMLElement | null, target: number, suffix = "") {
  if (!el) return;
  const duration = 1200;
  const startTime = performance.now();
  function tick(now: number) {
    const p = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el!.textContent = Math.round(target * eased).toLocaleString() + suffix;
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function getTimeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Baru saja";
  if (mins < 60) return mins + " menit lalu";
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours + " jam lalu";
  return Math.floor(hours / 24) + " hari lalu";
}

const AdminDashboard: React.FC = () => {
  const { showToast } = useToast();
  const [data, setData] = useState<AdminDashData | null>(null);
  const [attendanceList, setAttendanceList] = useState<any[]>([]);
  const [totalComplaints, setTotalComplaints] = useState(0);
  const [rankings, setRankings] = useState<PerformanceEvaluation[]>([]);
  const weeklyRef = useRef<HTMLCanvasElement>(null);
  const donutRef = useRef<HTMLCanvasElement>(null);
  const charts = useRef<Chart[]>([]);

  // Filter States
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filterType, setFilterType] = useState<"bulanan" | "custom">("bulanan");
  const [dateRangeStart, setDateRangeStart] = useState<string>("");
  const [dateRangeEnd, setDateRangeEnd] = useState<string>("");
  const [isSelectingDateRange, setIsSelectingDateRange] = useState(false);
  const [datePickerMonth, setDatePickerMonth] = useState(new Date());
  const [isSelectingStart, setIsSelectingStart] = useState(true);

  // Helper to get date string YYYY-MM-DD
  const toDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const loadDashboardData = async () => {
    let q = "";
    if (filterType === "bulanan") {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 0);
      q = `?startDate=${toDateString(start)}&endDate=${toDateString(end)}`;
    } else if (filterType === "custom" && dateRangeStart && dateRangeEnd) {
      q = `?startDate=${dateRangeStart}&endDate=${dateRangeEnd}`;
    }

    DashboardAPI.getAdmin(q).then((res) => {
      if (res && res.success) setData(res.data);
      else showToast("Gagal memuat dashboard", "error");
    });
  };

  useEffect(() => {
    loadDashboardData();
  }, [filterType, currentDate, dateRangeStart, dateRangeEnd]);

  useEffect(() => {
    // Load total complaints
    loadComplaints();
    loadRankings();

    loadAttendance();
    const iv = setInterval(loadAttendance, 15000);
    return () => {
      clearInterval(iv);
      charts.current.forEach((c) => c.destroy());
    };
  }, []);

  const handleFilterChange = (type: "bulanan" | "custom") => {
    setFilterType(type);
    if (type === "bulanan") setCurrentDate(new Date());
  };

  const handlePrevMonth = () =>
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() - 1),
    );
  const handleNextMonth = () =>
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() + 1),
    );

  const loadComplaints = async () => {
    try {
      const res = await ComplaintAPI.getAll();
      if (res && res.success) {
        setTotalComplaints((res.data || []).length);
      }
    } catch {
      console.error("Failed to load complaints");
    }
  };

  const loadRankings = async () => {
    const now = new Date();
    const res = await PerformanceAPI.getRanking(
      now.getMonth() + 1,
      now.getFullYear(),
    );
    if (res && res.success) setRankings((res.data || []).slice(0, 3));
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "#10b981";
    if (score >= 60) return "#f59e0b";
    if (score >= 40) return "#f97316";
    return "#ef4444";
  };

  const getGrade = (score: number) => {
    if (score >= 90) return "A+";
    if (score >= 80) return "A";
    if (score >= 70) return "B";
    if (score >= 60) return "C";
    if (score >= 50) return "D";
    return "E";
  };

  const loadAttendance = async () => {
    try {
      const res = await fetch("/api/attendance/today", {
        headers: { Authorization: "Bearer " + getToken() },
      });
      const d = await res.json();
      if (d.success) setAttendanceList(d.data || []);
    } catch {}
  };

  const exportToExcel = async () => {
    if (!data) {
      showToast("Data tidak tersedia", "error");
      return;
    }

    try {
      const todayStr = new Date().toLocaleDateString("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      const sheets: any[] = [];

      // Sheet 1: Ringkasan Dashboard
      sheets.push({
        sheetName: "Ringkasan",
        title: "RINGKASAN DASHBOARD",
        subtitle: "Laporan Monitoring Peserta Magang",
        infoLines: [`Tanggal Cetak: ${todayStr}`],
        columns: [
          { header: "No", key: "no", width: 6, type: "number" as const },
          { header: "Indikator", key: "indikator", width: 35 },
          { header: "Nilai", key: "nilai", width: 20, type: "number" as const },
          { header: "Keterangan", key: "keterangan", width: 30 },
        ],
        data: [
          {
            no: 1,
            indikator: "Total Peserta Magang",
            nilai: data.totalPeserta || 0,
            keterangan: "Peserta aktif",
          },
          {
            no: 2,
            indikator: "Total Kendala/Keluhan",
            nilai: totalComplaints,
            keterangan: "Laporan masuk",
          },
          {
            no: 3,
            indikator: "Rata-rata Produktivitas",
            nilai: data.avgProductivity || 0,
            keterangan: "Item/hari per orang",
          },
          {
            no: 4,
            indikator: "Tingkat Kehadiran Hari Ini",
            nilai: data.attendanceRate || 0,
            keterangan: `${data.todayAttendance || 0}/${data.totalPeserta || 0} hadir`,
          },
          {
            no: 5,
            indikator: "Total Berkas",
            nilai: data.totalBerkas || 0,
            keterangan: "Keseluruhan",
          },
          {
            no: 6,
            indikator: "Total Buku",
            nilai: data.totalBuku || 0,
            keterangan: "Keseluruhan",
          },
          {
            no: 7,
            indikator: "Total Bundle",
            nilai: data.totalBundle || 0,
            keterangan: "Keseluruhan",
          },
          {
            no: 8,
            indikator: "Grand Total Item",
            nilai:
              (data.totalBerkas || 0) +
              (data.totalBuku || 0) +
              (data.totalBundle || 0),
            keterangan: "Berkas + Buku + Bundle",
          },
        ],
      });

      // Sheet 2: Progres Mingguan
      if (data.weeklyProgress && data.weeklyProgress.length > 0) {
        const wp = data.weeklyProgress;
        const totalBerkas = wp.reduce((s, w) => s + (w.berkas || 0), 0);
        const totalBuku = wp.reduce((s, w) => s + (w.buku || 0), 0);
        const totalBundle = wp.reduce((s, w) => s + (w.bundle || 0), 0);

        sheets.push({
          sheetName: "Progres Mingguan",
          title: "PROGRES PEKERJAAN MINGGUAN",
          subtitle: "Tren penyelesaian tugas per kategori",
          infoLines: [
            `Periode: ${wp.length} hari terakhir`,
            `Total: ${totalBerkas + totalBuku + totalBundle} item`,
          ],
          columns: [
            { header: "No", key: "no", width: 6, type: "number" as const },
            {
              header: "Tanggal",
              key: "tanggal",
              width: 22,
              type: "date" as const,
            },
            {
              header: "Berkas",
              key: "berkas",
              width: 12,
              type: "number" as const,
            },
            { header: "Buku", key: "buku", width: 12, type: "number" as const },
            {
              header: "Bundle",
              key: "bundle",
              width: 12,
              type: "number" as const,
            },
            {
              header: "Total",
              key: "total",
              width: 12,
              type: "number" as const,
            },
          ],
          data: wp.map((w, i) => ({
            no: i + 1,
            tanggal: new Date(w._id).toLocaleDateString("id-ID", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            }),
            berkas: w.berkas || 0,
            buku: w.buku || 0,
            bundle: w.bundle || 0,
            total: (w.berkas || 0) + (w.buku || 0) + (w.bundle || 0),
          })),
          summaryRow: {
            no: "",
            tanggal: "",
            berkas: totalBerkas,
            buku: totalBuku,
            bundle: totalBundle,
            total: totalBerkas + totalBuku + totalBundle,
          },
          summaryLabel: "TOTAL",
        });
      }

      // Sheet 3: Distribusi Tugas
      if (data.workDistribution && data.workDistribution.length > 0) {
        const wd = data.workDistribution;
        const totalCount = wd.reduce((s, w) => s + (w.count || 0), 0);

        sheets.push({
          sheetName: "Distribusi Tugas",
          title: "DISTRIBUSI JENIS PEKERJAAN",
          subtitle: "Sebaran tugas berdasarkan kategori",
          infoLines: [
            `Total Jenis: ${wd.length} kategori`,
            `Total Pekerjaan: ${totalCount} item`,
          ],
          columns: [
            { header: "No", key: "no", width: 6, type: "number" as const },
            { header: "Jenis Pekerjaan", key: "jenis", width: 30 },
            {
              header: "Jumlah",
              key: "jumlah",
              width: 14,
              type: "number" as const,
            },
            { header: "Persentase", key: "persen", width: 14 },
          ],
          data: wd.map((w, i) => ({
            no: i + 1,
            jenis: w._id || "Lainnya",
            jumlah: w.count || 0,
            persen:
              totalCount > 0
                ? (((w.count || 0) / totalCount) * 100).toFixed(1) + "%"
                : "0%",
          })),
          summaryRow: { no: "", jenis: "", jumlah: totalCount, persen: "100%" },
          summaryLabel: "TOTAL",
        });
      }

      // Sheet 4: Top Peserta
      if (data.topPerformers && data.topPerformers.length > 0) {
        sheets.push({
          sheetName: "Top Peserta",
          title: "PERINGKAT PESERTA TERBAIK",
          subtitle: "Berdasarkan total item yang diselesaikan",
          infoLines: [`Total: ${data.topPerformers.length} peserta`],
          columns: [
            {
              header: "Peringkat",
              key: "rank",
              width: 12,
              type: "number" as const,
            },
            { header: "Nama Peserta", key: "nama", width: 28 },
            { header: "Institusi", key: "instansi", width: 30 },
            {
              header: "Total Item",
              key: "totalItems",
              width: 14,
              type: "number" as const,
            },
          ],
          data: data.topPerformers.map((p, i) => ({
            rank: i + 1,
            nama: p.name || "-",
            instansi: p.instansi || "-",
            totalItems: p.totalItems || 0,
          })),
        });
      }

      // Sheet 5: Kehadiran Hari Ini
      if (attendanceList.length > 0) {
        const aktif = attendanceList.filter((r: any) => !r.jamKeluar).length;
        const keluar = attendanceList.filter((r: any) => r.jamKeluar).length;

        sheets.push({
          sheetName: "Kehadiran Hari Ini",
          title: "DAFTAR KEHADIRAN HARI INI",
          subtitle: todayStr,
          infoLines: [
            `Total Hadir: ${attendanceList.length} peserta`,
            `Aktif: ${aktif} | Sudah Keluar: ${keluar}`,
          ],
          columns: [
            { header: "No", key: "no", width: 6, type: "number" as const },
            { header: "Nama Peserta", key: "nama", width: 28 },
            { header: "Institusi", key: "instansi", width: 30 },
            { header: "Jam Masuk", key: "jamMasuk", width: 14 },
            { header: "Jam Keluar", key: "jamKeluar", width: 14 },
            { header: "Status", key: "status", width: 14 },
          ],
          data: attendanceList.map((r: any, i: number) => ({
            no: i + 1,
            nama: r.userId?.name || "Unknown",
            instansi: r.userId?.instansi || "-",
            jamMasuk: r.jamMasuk || "-",
            jamKeluar: r.jamKeluar || "Belum Keluar",
            status: r.jamKeluar ? "Selesai" : "Aktif",
          })),
        });
      }

      // Sheet 6: Aktivitas Terbaru
      if (data.recentActivity && data.recentActivity.length > 0) {
        const ra = data.recentActivity;
        const totalB = ra.reduce((s: number, a: any) => s + (a.berkas || 0), 0);
        const totalK = ra.reduce((s: number, a: any) => s + (a.buku || 0), 0);
        const totalBd = ra.reduce(
          (s: number, a: any) => s + (a.bundle || 0),
          0,
        );

        sheets.push({
          sheetName: "Aktivitas Terbaru",
          title: "AKTIVITAS PEKERJAAN TERBARU",
          subtitle: "Update terkini dari peserta magang",
          infoLines: [
            `Total: ${ra.length} aktivitas`,
            `Berkas: ${totalB} | Buku: ${totalK} | Bundle: ${totalBd}`,
          ],
          columns: [
            { header: "No", key: "no", width: 6, type: "number" as const },
            { header: "Nama Peserta", key: "nama", width: 24 },
            { header: "Jenis Pekerjaan", key: "jenis", width: 22 },
            {
              header: "Berkas",
              key: "berkas",
              width: 10,
              type: "number" as const,
            },
            { header: "Buku", key: "buku", width: 10, type: "number" as const },
            {
              header: "Bundle",
              key: "bundle",
              width: 10,
              type: "number" as const,
            },
            {
              header: "Tanggal",
              key: "tanggal",
              width: 22,
              type: "date" as const,
            },
            { header: "Keterangan", key: "keterangan", width: 28 },
          ],
          data: ra.map((a: any, i: number) => ({
            no: i + 1,
            nama:
              typeof a.userId === "string"
                ? "Unknown"
                : a.userId?.name || "Unknown",
            jenis: a.jenis || "-",
            berkas: a.berkas || 0,
            buku: a.buku || 0,
            bundle: a.bundle || 0,
            tanggal: new Date(a.createdAt).toLocaleDateString("id-ID", {
              day: "numeric",
              month: "long",
              year: "numeric",
            }),
            keterangan: a.keterangan || "-",
          })),
          summaryRow: {
            no: "",
            nama: "",
            jenis: "",
            berkas: totalB,
            buku: totalK,
            bundle: totalBd,
            tanggal: "",
            keterangan: "",
          },
          summaryLabel: "TOTAL",
        });
      }

      await exportExcel({
        fileName: "Dashboard_Monitoring",
        companyName: "SISMON Magang",
        creator: "Admin Dashboard",
        sheets,
      });
      showToast("Data berhasil diekspor ke Excel", "success");
    } catch (error) {
      console.error("Export error:", error);
      showToast("Gagal mengekspor data", "error");
    }
  };

  useEffect(() => {
    if (!data) return;
    charts.current.forEach((c) => c.destroy());
    charts.current = [];

    // Weekly chart (Rekardus Area Chart)
    if (weeklyRef.current) {
      const wp = data.weeklyProgress || [];
      const labels = wp.map((w) =>
        new Date(w._id).toLocaleDateString("id-ID", {
          weekday: "short",
          day: "numeric",
          month: "short",
        }),
      );
      // Backend now sends 'total' in weeklyProgress for Rekardus
      const datasetData = wp.map(
        (w) => (w as any).total || w.berkas + w.buku + w.bundle,
      );

      const c = new Chart(weeklyRef.current, {
        type: "line",
        data: {
          labels: labels.length ? labels : ["No data"],
          datasets: [
            {
              label: "Rekardus",
              data: datasetData,
              backgroundColor: "rgba(59, 130, 246, 0.2)", // Area fill color
              borderColor: "#3b82f6", // Line color
              borderWidth: 2,
              pointBackgroundColor: "#fff",
              pointBorderColor: "#3b82f6",
              pointRadius: 4,
              pointHoverRadius: 6,
              fill: true,
              tension: 0.3, // Smooth curve
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false,
            },
            tooltip: {
              backgroundColor: "#fff",
              titleColor: "#1e293b",
              bodyColor: "#64748b",
              borderColor: "#e2e8f0",
              borderWidth: 1,
              cornerRadius: 10,
              padding: 12,
              displayColors: false,
            },
          },
          scales: {
            x: { grid: { display: false }, ticks: { color: "#94a3b8" } },
            y: {
              grid: { color: "rgba(226,232,240,0.5)" },
              ticks: { color: "#94a3b8" },
              beginAtZero: true,
            },
          },
        },
      });
      charts.current.push(c);
    }

    // Donut chart — Register totals (berkas, buku, bundle)
    if (donutRef.current) {
      const regStats = (data as any).registerStats || {
        berkas: 0,
        buku: 0,
        bundle: 0,
      };
      const totalBerkas = regStats.berkas || 0;
      const totalBuku = regStats.buku || 0;
      const totalBundle = regStats.bundle || 0;
      const grandTotal = totalBerkas + totalBuku + totalBundle;
      const donutColors = ["#4db8e8", "#8b5cf6", "#22c55e"];
      const c = new Chart(donutRef.current, {
        type: "doughnut",
        data: {
          labels: ["Berkas", "Buku", "Bundle"],
          datasets: [
            {
              data: [totalBerkas, totalBuku, totalBundle],
              backgroundColor: donutColors,
              borderWidth: 3,
              borderColor: "#fff",
              hoverOffset: 8,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: "68%",
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
        plugins: [
          {
            id: "centerText",
            beforeDraw(chart) {
              const { ctx, width, height } = chart;
              ctx.save();
              ctx.font = "bold 28px sans-serif";
              ctx.fillStyle = "#1a1a2e";
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillText(
                grandTotal.toLocaleString(),
                width / 2,
                height / 2 - 8,
              );
              ctx.font = "12px sans-serif";
              ctx.fillStyle = "#94a3b8";
              ctx.fillText("Total Item", width / 2, height / 2 + 16);
              ctx.restore();
            },
          },
        ],
      });
      charts.current.push(c);
    }
  }, [data]);

  if (!data)
    return (
      <div className="text-center p-16 text-gray-400">
        Memuat dashboard...
      </div>
    );

  const ra = data.recentActivity || [];
  const donutLegendItems = [
    { label: "Berkas", color: "#4db8e8" },
    { label: "Buku", color: "#8b5cf6" },
    { label: "Bundle", color: "#22c55e" },
  ];

  return (
    <>
      <div className="page-header-row">
        <div className="page-header">
          <h1>Dashboard Monitoring</h1>
          <p>Overview produktivitas dan kehadiran peserta magang</p>
        </div>

        <div className="dashboard-filter-bar">
          {/* Filter UI */}
          <div className="dashboard-filter-group">
            <button
              onClick={() => handleFilterChange("bulanan")}
              className={`dashboard-filter-btn ${filterType === "bulanan" ? "active" : ""}`}
            >
              Bulanan
            </button>
            <button
              onClick={() => {
                handleFilterChange("custom");
                if (!isSelectingDateRange) setIsSelectingStart(true);
              }}
              className={`dashboard-filter-btn ${filterType === "custom" ? "active" : ""}`}
            >
              Custom
            </button>
          </div>

          <div className="dashboard-month-export-row">
            {filterType === "bulanan" ? (
              <div className="month-picker-container">
                <button onClick={handlePrevMonth} className="month-nav-btn">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="15 18 9 12 15 6"></polyline>
                  </svg>
                </button>
                <span className="month-display">
                  {currentDate.toLocaleDateString("id-ID", {
                    month: "long",
                    year: "numeric",
                  })}
                </span>
                <button onClick={handleNextMonth} className="month-nav-btn">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </button>
              </div>
            ) : (
              <div className="dashboard-custom-date">
                <button
                  onClick={() => setIsSelectingDateRange(!isSelectingDateRange)}
                  className="dashboard-custom-trigger"
                >
                  {dateRangeStart && dateRangeEnd
                    ? `${dateRangeStart} - ${dateRangeEnd}`
                    : "Pilih Tanggal"}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>

                {isSelectingDateRange && (
                  <div className="dashboard-date-popup">
                    <div className="mb-3">
                      <p className="text-xs text-gray-500 mb-1">
                        {isSelectingStart
                          ? "Pilih Tanggal Awal"
                          : "Pilih Tanggal Akhir"}
                      </p>
                      <div className="text-sm font-semibold">
                        {dateRangeStart || "-"} s/d {dateRangeEnd || "-"}
                      </div>
                    </div>

                    <div className="flex justify-between items-center mb-3">
                      <button
                        onClick={() =>
                          setDatePickerMonth(
                            new Date(
                              datePickerMonth.getFullYear(),
                              datePickerMonth.getMonth() - 1,
                            ),
                          )
                        }
                        className="p-1"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="15 18 9 12 15 6"></polyline>
                        </svg>
                      </button>
                      <span className="text-sm font-semibold">
                        {datePickerMonth.toLocaleDateString("id-ID", {
                          month: "long",
                          year: "numeric",
                        })}
                      </span>
                      <button
                        onClick={() =>
                          setDatePickerMonth(
                            new Date(
                              datePickerMonth.getFullYear(),
                              datePickerMonth.getMonth() + 1,
                            ),
                          )
                        }
                        className="p-1"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                      </button>
                    </div>

                    <div className="grid grid-cols-7 gap-0.5 mb-2">
                      {["M", "S", "S", "R", "K", "J", "S"].map((d) => (
                        <div
                          key={d}
                          className="text-[11px] text-center text-gray-400 p-1"
                        >
                          {d}
                        </div>
                      ))}
                      {Array.from({
                        length: new Date(
                          datePickerMonth.getFullYear(),
                          datePickerMonth.getMonth(),
                          1,
                        ).getDay(),
                      }).map((_, i) => (
                        <div key={`e-${i}`} />
                      ))}
                      {Array.from({
                        length: new Date(
                          datePickerMonth.getFullYear(),
                          datePickerMonth.getMonth() + 1,
                          0,
                        ).getDate(),
                      }).map((_, i) => {
                        const d = i + 1;
                        const dateStr = `${datePickerMonth.getFullYear()}-${String(datePickerMonth.getMonth() + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                        const isSelected =
                          dateStr === dateRangeStart ||
                          dateStr === dateRangeEnd;
                        const inRange =
                          dateRangeStart &&
                          dateRangeEnd &&
                          dateStr > dateRangeStart &&
                          dateStr < dateRangeEnd;

                        return (
                          <div
                            key={d}
                            onClick={() => {
                              if (isSelectingStart) {
                                setDateRangeStart(dateStr);
                                setDateRangeEnd("");
                                setIsSelectingStart(false);
                              } else {
                                if (dateStr >= dateRangeStart) {
                                  setDateRangeEnd(dateStr);
                                  setIsSelectingDateRange(false);
                                  setIsSelectingStart(true);
                                } else {
                                  showToast(
                                    "Tanggal akhir harus lebih besar",
                                    "error",
                                  );
                                }
                              }
                            }}
                            className={`p-1.5 text-center text-[13px] cursor-pointer rounded ${
                              isSelected
                                ? 'bg-primary-500 text-white'
                                : inRange
                                  ? 'bg-primary-50'
                                  : 'hover:bg-gray-100'
                            }`}
                          >
                            {d}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              className="btn-export"
              onClick={exportToExcel}
              title="Ekspor ke Excel"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Ekspor Excel
            </button>
          </div>
        </div>
      </div>
      <div className="admin-stats-grid">
        <div className="admin-stat-card">
          <div className="stat-info">
            <div className="stat-label">Kehadiran Hari Ini</div>
            <div
              className="stat-value"
              ref={(el) =>
                el &&
                attendanceList &&
                animateCounter(el, attendanceList.length)
              }
            >
              0
            </div>
            <div className="stat-change">
              dari {data?.totalPeserta || 0} peserta
            </div>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-info">
            <div className="stat-label">Total Sortir</div>
            <div
              className="stat-value"
              ref={(el) =>
                el && data && animateCounter(el, data.totalSortir || 0)
              }
            >
              0
            </div>
            <div className="stat-change">Item selesai</div>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-info">
            <div className="stat-label">Total Pencopotan Steples</div>
            <div
              className="stat-value"
              ref={(el) =>
                el && data && animateCounter(el, data.totalSteples || 0)
              }
            >
              0
            </div>
            <div className="stat-change">Item selesai</div>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-info">
            <div className="stat-label">Total Scanning</div>
            <div
              className="stat-value"
              ref={(el) =>
                el && data && animateCounter(el, data.totalScanning || 0)
              }
            >
              0
            </div>
            <div className="stat-change">Item selesai</div>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-info">
            <div className="stat-label">Total Register</div>
            <div
              className="stat-value"
              ref={(el) =>
                el && data && animateCounter(el, data.totalRegister || 0)
              }
            >
              0
            </div>
            <div className="stat-change">Item selesai</div>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-info">
            <div className="stat-label">Total Stikering</div>
            <div
              className="stat-value"
              ref={(el) =>
                el && data && animateCounter(el, data.totalStikering || 0)
              }
            >
              0
            </div>
            <div className="stat-change">Item selesai</div>
          </div>
        </div>
      </div>

      <div className="charts-row">
        <div className="chart-card">
          <div className="chart-header">
            <h3>Grafik Rekardus</h3>
            <p>
              Total Rekardus:{" "}
              <strong>{(data.totalRekardus || 0).toLocaleString()}</strong> item
            </p>
          </div>
          <div className="chart-canvas-wrapper">
            <canvas ref={weeklyRef} />
          </div>
        </div>
        <div className="chart-card">
          <div className="chart-header">
            <h3>Kategori Arsip</h3>
            <p>Total tiap kategori berkas, buku, dan bundle</p>
          </div>
          <div className="chart-canvas-wrapper h-[220px]">
            <canvas ref={donutRef} />
          </div>
          <div className="donut-legend">
            {donutLegendItems.map((item) => (
              <div key={item.label} className="legend-item">
                <span
                  className="legend-dot"
                  style={{ background: item.color }}
                />
                {item.label}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mb-7">
        <div className="chart-card">
          <div className="chart-header">
            <div className="flex items-center gap-2.5 mb-1">
              <span className="text-xl">🏆</span>
              <h3>Top 3 Peserta Terbaik</h3>
            </div>
            <p>Berdasarkan penilaian performa bulan ini</p>
          </div>
          {rankings.length === 0 ? (
            <p className="text-center text-gray-400 p-8">
              Belum ada data ranking
            </p>
          ) : (
            <div className="podium-section mb-0">
              {rankings.length >= 2 && (
                <div className="podium-card podium-2">
                  <div className="podium-medal">🥈</div>
                  <div className="podium-name">
                    {(rankings[1].userId as User)?.name || "-"}
                  </div>
                  <div className="podium-instansi">
                    {(rankings[1].userId as User)?.instansi || "-"}
                  </div>
                  <div
                    className="podium-score"
                    style={{ color: getScoreColor(rankings[1].hasil) }}
                  >
                    {rankings[1].hasil}%
                  </div>
                  <div className="podium-grade">
                    {getGrade(rankings[1].hasil)}
                  </div>
                </div>
              )}
              <div className="podium-card podium-1">
                <div className="podium-medal">🥇</div>
                <div className="podium-name">
                  {(rankings[0].userId as User)?.name || "-"}
                </div>
                <div className="podium-instansi">
                  {(rankings[0].userId as User)?.instansi || "-"}
                </div>
                <div
                  className="podium-score"
                  style={{ color: getScoreColor(rankings[0].hasil) }}
                >
                  {rankings[0].hasil}%
                </div>
                <div className="podium-grade">
                  {getGrade(rankings[0].hasil)}
                </div>
              </div>
              {rankings.length >= 3 && (
                <div className="podium-card podium-3">
                  <div className="podium-medal">🥉</div>
                  <div className="podium-name">
                    {(rankings[2].userId as User)?.name || "-"}
                  </div>
                  <div className="podium-instansi">
                    {(rankings[2].userId as User)?.instansi || "-"}
                  </div>
                  <div
                    className="podium-score"
                    style={{ color: getScoreColor(rankings[2].hasil) }}
                  >
                    {rankings[2].hasil}%
                  </div>
                  <div className="podium-grade">
                    {getGrade(rankings[2].hasil)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="activity-card">
        <div className="activity-header">
          <div>
            <h3>📋 Daftar Kehadiran Hari Ini</h3>
            <p>Peserta yang sudah absen</p>
          </div>
        </div>
        {attendanceList.length === 0 ? (
          <div className="text-center p-6 text-slate-400">
            Belum ada peserta yang absen hari ini
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {attendanceList.map((r: any, i: number) => {
              const name = r.userId?.name || "Unknown";
              const initials = name
                .split(" ")
                .map((n: string) => n[0])
                .join("")
                .substring(0, 2)
                .toUpperCase();
              return (
                <div
                  key={r._id}
                  className="flex items-center justify-between px-3.5 py-2.5 bg-slate-50 rounded-[10px] border border-slate-100"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-300 to-blue-100 text-slate-800 flex items-center justify-center text-xs font-bold">
                      {initials}
                    </div>
                    <div>
                      <div className="font-semibold text-[13px]">
                        {name}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {r.userId?.instansi || "-"}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-sm text-[#0a6599]">
                      {r.jamMasuk || "-"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div className="activity-card">
        <div className="activity-header">
          <div>
            <h3>Aktivitas Terbaru</h3>
            <p>Update terkini dari peserta</p>
          </div>
        </div>
        <div className="activity-feed">
          {ra.length === 0 ? (
            <p className="text-center text-gray-400 p-8">
              Belum ada aktivitas
            </p>
          ) : (
            ra.map((a: any, i: number) => {
              const name = a.userId?.name || "Unknown";
              return (
                <div
                  key={a._id || i}
                  className="activity-feed-item"
                  style={{ animationDelay: `${i * 0.08}s` }}
                >
                  <div className="afi-icon">
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
                  <div className="afi-content">
                    <div className="afi-name">{name}</div>
                    <div className="afi-desc">
                      {a.jenis}: {a.berkas} berkas, {a.buku} buku, {a.bundle}{" "}
                      bundle
                    </div>
                  </div>
                  <span className="afi-time">{getTimeAgo(a.createdAt)}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
};

export default AdminDashboard;
