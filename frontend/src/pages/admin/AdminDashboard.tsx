import React, { useEffect, useState, useRef } from "react";
import { Chart, registerables } from "chart.js";
import * as XLSX from "xlsx";
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
  const [filterType, setFilterType] = useState<'bulanan' | 'custom'>('bulanan');
  const [dateRangeStart, setDateRangeStart] = useState<string>('');
  const [dateRangeEnd, setDateRangeEnd] = useState<string>('');
  const [isSelectingDateRange, setIsSelectingDateRange] = useState(false);
  const [datePickerMonth, setDatePickerMonth] = useState(new Date());
  const [isSelectingStart, setIsSelectingStart] = useState(true);

  // Helper to get date string YYYY-MM-DD
  const toDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const loadDashboardData = async () => {
    let q = '';
    if (filterType === 'bulanan') {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 0);
      q = `?startDate=${toDateString(start)}&endDate=${toDateString(end)}`;
    } else if (filterType === 'custom' && dateRangeStart && dateRangeEnd) {
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

  const handleFilterChange = (type: 'bulanan' | 'custom') => {
    setFilterType(type);
    if(type === 'bulanan') setCurrentDate(new Date());
  };

  const handlePrevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  const handleNextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));

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

  const exportToExcel = () => {
    if (!data) {
      showToast("Data tidak tersedia", "error");
      return;
    }

    try {
      const workbook = XLSX.utils.book_new();

      // Sheet 1: Summary Stats
      const summaryData = [
        ["RINGKASAN DASHBOARD PESERTA MAGANG", ""],
        [""],
        ["Total Kendala", totalComplaints],
        ["Total Peserta Magang", data.totalPeserta || 0],
        ["Rata-rata Produktivitas (Item/hari)", data.avgProductivity || 0],
        ["Tingkat Kehadiran Hari Ini", (data.attendanceRate || 0) + "%"],
        [
          "Peserta Hadir Hari Ini",
          (data.todayAttendance || 0) + "/" + (data.totalPeserta || 0),
        ],
      ];
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      summarySheet["!cols"] = [{ wch: 30 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(workbook, summarySheet, "Ringkasan");

      // Sheet 2: Weekly Progress
      if (data.weeklyProgress && data.weeklyProgress.length > 0) {
        const weeklyHeaders = ["Tanggal", "Berkas", "Buku", "Bundle"];
        const weeklyData = data.weeklyProgress.map((w) => [
          new Date(w._id).toLocaleDateString("id-ID"),
          w.berkas || 0,
          w.buku || 0,
          w.bundle || 0,
        ]);
        const weeklySheet = XLSX.utils.aoa_to_sheet([
          weeklyHeaders,
          ...weeklyData,
        ]);
        weeklySheet["!cols"] = [
          { wch: 15 },
          { wch: 12 },
          { wch: 12 },
          { wch: 12 },
        ];
        XLSX.utils.book_append_sheet(workbook, weeklySheet, "Progres Mingguan");
      }

      // Sheet 3: Work Distribution
      if (data.workDistribution && data.workDistribution.length > 0) {
        const distHeaders = ["Jenis Pekerjaan", "Jumlah"];
        const distData = data.workDistribution.map((w) => [
          w._id || "Lainnya",
          w.count || 0,
        ]);
        const distSheet = XLSX.utils.aoa_to_sheet([distHeaders, ...distData]);
        distSheet["!cols"] = [{ wch: 30 }, { wch: 15 }];
        XLSX.utils.book_append_sheet(workbook, distSheet, "Distribusi Tugas");
      }

      // Sheet 4: Top Performers
      if (data.topPerformers && data.topPerformers.length > 0) {
        const perfHeaders = [
          "Peringkat",
          "Nama Peserta",
          "Total Item",
          "Institusi",
        ];
        const perfData = data.topPerformers.map((p, i) => [
          i + 1,
          p.name || "-",
          p.totalItems || 0,
          p.instansi || "-",
        ]);
        const perfSheet = XLSX.utils.aoa_to_sheet([perfHeaders, ...perfData]);
        perfSheet["!cols"] = [
          { wch: 12 },
          { wch: 25 },
          { wch: 15 },
          { wch: 30 },
        ];
        XLSX.utils.book_append_sheet(workbook, perfSheet, "Top Peserta");
      }

      // Sheet 5: Today's Attendance
      if (attendanceList.length > 0) {
        const attHeaders = [
          "No",
          "Nama Peserta",
          "Institusi",
          "Jam Masuk",
          "Jam Keluar",
          "Status",
        ];
        const attData = attendanceList.map((r, i) => [
          i + 1,
          r.userId?.name || "Unknown",
          r.userId?.instansi || "-",
          r.jamMasuk || "-",
          r.jamKeluar || "Belum Keluar",
          r.jamKeluar ? "Keluar" : "Aktif",
        ]);
        const attSheet = XLSX.utils.aoa_to_sheet([attHeaders, ...attData]);
        attSheet["!cols"] = [
          { wch: 8 },
          { wch: 25 },
          { wch: 30 },
          { wch: 12 },
          { wch: 12 },
          { wch: 12 },
        ];
        XLSX.utils.book_append_sheet(workbook, attSheet, "Kehadiran Hari Ini");
      }

      // Sheet 6: Recent Activity
      if (data.recentActivity && data.recentActivity.length > 0) {
        const actHeaders = [
          "No",
          "Nama Peserta",
          "Jenis Pekerjaan",
          "Berkas",
          "Buku",
          "Bundle",
          "Tanggal",
          "Keterangan",
        ];
        const actData = data.recentActivity.map((a, i) => {
          const userName =
            typeof a.userId === "string"
              ? "Unknown"
              : a.userId?.name || "Unknown";
          return [
            i + 1,
            userName,
            a.jenis || "-",
            a.berkas || 0,
            a.buku || 0,
            a.bundle || 0,
            new Date(a.createdAt).toLocaleDateString("id-ID"),
            a.keterangan || "-",
          ];
        });
        const actSheet = XLSX.utils.aoa_to_sheet([actHeaders, ...actData]);
        actSheet["!cols"] = [
          { wch: 8 },
          { wch: 25 },
          { wch: 25 },
          { wch: 10 },
          { wch: 10 },
          { wch: 10 },
          { wch: 15 },
          { wch: 20 },
        ];
        XLSX.utils.book_append_sheet(workbook, actSheet, "Aktivitas Terbaru");
      }

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().split("T")[0];
      const filename = `Dashboard-Monitoring-${timestamp}.xlsx`;

      // Write file
      XLSX.writeFile(workbook, filename);
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
        new Date(w._id).toLocaleDateString("id-ID", { weekday: "short", day: 'numeric', month: 'short' }),
      );
      // Backend now sends 'total' in weeklyProgress for Rekardus
      const datasetData = wp.map((w) => (w as any).total || (w.berkas + w.buku + w.bundle));

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
      const regStats = (data as any).registerStats || { berkas: 0, buku: 0, bundle: 0 };
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
      <div
        style={{ textAlign: "center", padding: 60, color: "var(--gray-400)" }}
      >
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
      <div className="page-header-row" style={{ alignItems: 'center' }}>
        <div className="page-header" style={{ marginBottom: 0 }}>
          <h1>Dashboard Monitoring</h1>
          <p>Overview produktivitas dan kehadiran peserta magang</p>
        </div>
        
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {/* Filter UI */}
          <div className="dashboard-filter" style={{ display: 'flex', background: 'white', padding: 4, borderRadius: 'var(--radius-md)', border: '1px solid var(--gray-200)' }}>
            <button 
              onClick={() => handleFilterChange('bulanan')}
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                fontSize: 13,
                fontWeight: 600,
                background: filterType === 'bulanan' ? 'var(--primary-50)' : 'transparent',
                color: filterType === 'bulanan' ? 'var(--primary-600)' : 'var(--gray-500)',
                transition: 'all 0.2s'
              }}
            >
              Bulanan
            </button>
            <button 
              onClick={() => {
                handleFilterChange('custom');
                if(!isSelectingDateRange) setIsSelectingStart(true);
              }}
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                fontSize: 13,
                fontWeight: 600,
                background: filterType === 'custom' ? 'var(--primary-50)' : 'transparent',
                color: filterType === 'custom' ? 'var(--primary-600)' : 'var(--gray-500)',
                transition: 'all 0.2s'
              }}
            >
              Custom
            </button>
          </div>

          {filterType === 'bulanan' ? (
             <div style={{ position: 'relative', display: 'flex', alignItems: 'center', background: 'white', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-md)', padding: '0 12px', height: 40 }}>
               <button onClick={handlePrevMonth} style={{ background: 'none', color: 'var(--gray-500)', padding: 4 }}>
                 <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
               </button>
               <span style={{ margin: '0 12px', fontSize: 14, fontWeight: 600, minWidth: 100, textAlign: 'center' }}>
                 {currentDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
               </span>
               <button onClick={handleNextMonth} style={{ background: 'none', color: 'var(--gray-500)', padding: 4 }}>
                 <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
               </button>
             </div>
          ) : (
            <div style={{ position: 'relative' }}>
              <button 
                onClick={() => setIsSelectingDateRange(!isSelectingDateRange)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: 'white', border: '1px solid var(--gray-200)',
                  borderRadius: 'var(--radius-md)', padding: '0 12px', height: 40,
                  fontSize: 13, fontWeight: 500, color: 'var(--gray-700)', minWidth: 200, justifyContent: 'space-between'
                }}
              >
                {dateRangeStart && dateRangeEnd ? `${dateRangeStart} - ${dateRangeEnd}` : 'Pilih Tanggal'}
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </button>
              
              {isSelectingDateRange && (
                <div style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: 8,
                  background: 'white', border: '1px solid var(--gray-200)',
                  borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)',
                  padding: 16, zIndex: 50, width: 320
                }}>
                  <div style={{ marginBottom: 12 }}>
                    <p style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 4 }}>
                      {isSelectingStart ? 'Pilih Tanggal Awal' : 'Pilih Tanggal Akhir'}
                    </p>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>
                      {dateRangeStart || '-'} s/d {dateRangeEnd || '-'}
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <button onClick={() => setDatePickerMonth(new Date(datePickerMonth.getFullYear(), datePickerMonth.getMonth()-1))} style={{ padding: 4 }}><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg></button>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{datePickerMonth.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</span>
                    <button onClick={() => setDatePickerMonth(new Date(datePickerMonth.getFullYear(), datePickerMonth.getMonth()+1))} style={{ padding: 4 }}><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg></button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 8 }}>
                    {['M','S','S','R','K','J','S'].map(d => <div key={d} style={{ fontSize: 11, textAlign: 'center', color: 'var(--gray-400)', padding: 4 }}>{d}</div>)}
                    {Array.from({ length: new Date(datePickerMonth.getFullYear(), datePickerMonth.getMonth(), 1).getDay() }).map((_, i) => <div key={`e-${i}`} />)}
                    {Array.from({ length: new Date(datePickerMonth.getFullYear(), datePickerMonth.getMonth()+1, 0).getDate() }).map((_, i) => {
                      const d = i + 1;
                      const dateStr = `${datePickerMonth.getFullYear()}-${String(datePickerMonth.getMonth()+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                      const isSelected = dateStr === dateRangeStart || dateStr === dateRangeEnd;
                      const inRange = dateRangeStart && dateRangeEnd && dateStr > dateRangeStart && dateStr < dateRangeEnd;
                      
                      return (
                        <div 
                          key={d} 
                          onClick={() => {
                            if (isSelectingStart) {
                              setDateRangeStart(dateStr);
                              setDateRangeEnd('');
                              setIsSelectingStart(false);
                            } else {
                              if (dateStr >= dateRangeStart) {
                                setDateRangeEnd(dateStr);
                                setIsSelectingDateRange(false);
                                setIsSelectingStart(true);
                              } else {
                                showToast('Tanggal akhir harus lebih besar', 'error');
                              }
                            }
                          }}
                          style={{
                            padding: 6, textAlign: 'center', fontSize: 13, cursor: 'pointer', borderRadius: 4,
                            background: isSelected ? 'var(--primary-500)' : inRange ? 'var(--primary-50)' : 'transparent',
                            color: isSelected ? 'white' : 'inherit'
                          }}
                        >
                          {d}
                        </div>
                      )
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
      <div className="admin-stats-grid" style={{ display: "grid", overflowX: "auto" }}>
        <div className="admin-stat-card">
          <div className="stat-info">
            <div className="stat-label">Total Sortir</div>
            <div className="stat-value" ref={el => el && data && animateCounter(el, data.totalSortir || 0)}>0</div>
            <div className="stat-change">Item selesai</div>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-info">
            <div className="stat-label">Total Pencopotan Steples</div>
            <div className="stat-value" ref={el => el && data && animateCounter(el, data.totalSteples || 0)}>0</div>
            <div className="stat-change">Item selesai</div>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-info">
            <div className="stat-label">Total Scanning</div>
            <div className="stat-value" ref={el => el && data && animateCounter(el, data.totalScanning || 0)}>0</div>
            <div className="stat-change">Item selesai</div>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-info">
            <div className="stat-label">Total Register</div>
            <div className="stat-value" ref={el => el && data && animateCounter(el, data.totalRegister || 0)}>0</div>
            <div className="stat-change">Item selesai</div>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-info">
            <div className="stat-label">Total Stikering</div>
            <div className="stat-value" ref={el => el && data && animateCounter(el, data.totalStikering || 0)}>0</div>
            <div className="stat-change">Item selesai</div>
          </div>
        </div>
      </div>

      <div className="charts-row">
        <div className="chart-card">
          <div className="chart-header">
            <h3>Grafik Rekardus</h3>
            <p>Total Rekardus: <strong>{(data.totalRekardus || 0).toLocaleString()}</strong> item</p>
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
          <div className="chart-canvas-wrapper" style={{ height: 220 }}>
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
      <div style={{ marginBottom: 28 }}>
        <div className="chart-card">
          <div className="chart-header">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 4,
              }}
            >
              <span style={{ fontSize: 20 }}>🏆</span>
              <h3>Top 3 Peserta Terbaik</h3>
            </div>
            <p>Berdasarkan penilaian performa bulan ini</p>
          </div>
          {rankings.length === 0 ? (
            <p
              style={{
                textAlign: "center",
                color: "var(--gray-400)",
                padding: 30,
              }}
            >
              Belum ada data ranking
            </p>
          ) : (
            <div className="podium-section" style={{ marginBottom: 0 }}>
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
          <div style={{ textAlign: "center", padding: 24, color: "#94a3b8" }}>
            Belum ada peserta yang absen hari ini
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 14px",
                    background: "#f8fafc",
                    borderRadius: 10,
                    border: "1px solid #f1f5f9",
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 10 }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        background: "linear-gradient(135deg,#93c5fd,#dbeafe)",
                        color: "#1e293b",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {initials}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>
                        {name}
                      </div>
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>
                        {r.userId?.instansi || "-"}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: 14,
                        color: "#0a6599",
                      }}
                    >
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
            <p
              style={{
                textAlign: "center",
                color: "var(--gray-400)",
                padding: 30,
              }}
            >
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
