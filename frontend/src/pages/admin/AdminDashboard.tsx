import React, { useEffect, useState, useRef } from "react";
import { Chart, registerables } from "chart.js";
import { exportExcel } from '../../utils/excelExport';
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

  useEffect(() => {
    DashboardAPI.getAdmin().then((res) => {
      if (res && res.success) setData(res.data);
      else showToast("Gagal memuat dashboard", "error");
    });

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
      const todayStr = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      const sheets: any[] = [];

      // Sheet 1: Ringkasan Dashboard
      sheets.push({
        sheetName: 'Ringkasan',
        title: 'RINGKASAN DASHBOARD',
        subtitle: 'Laporan Monitoring Peserta Magang',
        infoLines: [
          `Tanggal Cetak: ${todayStr}`,
        ],
        columns: [
          { header: 'No', key: 'no', width: 6, type: 'number' as const },
          { header: 'Indikator', key: 'indikator', width: 35 },
          { header: 'Nilai', key: 'nilai', width: 20, type: 'number' as const },
          { header: 'Keterangan', key: 'keterangan', width: 30 },
        ],
        data: [
          { no: 1, indikator: 'Total Peserta Magang', nilai: data.totalPeserta || 0, keterangan: 'Peserta aktif' },
          { no: 2, indikator: 'Total Kendala/Keluhan', nilai: totalComplaints, keterangan: 'Laporan masuk' },
          { no: 3, indikator: 'Rata-rata Produktivitas', nilai: data.avgProductivity || 0, keterangan: 'Item/hari per orang' },
          { no: 4, indikator: 'Tingkat Kehadiran Hari Ini', nilai: data.attendanceRate || 0, keterangan: `${data.todayAttendance || 0}/${data.totalPeserta || 0} hadir` },
          { no: 5, indikator: 'Total Berkas', nilai: data.totalBerkas || 0, keterangan: 'Keseluruhan' },
          { no: 6, indikator: 'Total Buku', nilai: data.totalBuku || 0, keterangan: 'Keseluruhan' },
          { no: 7, indikator: 'Total Bundle', nilai: data.totalBundle || 0, keterangan: 'Keseluruhan' },
          { no: 8, indikator: 'Grand Total Item', nilai: (data.totalBerkas || 0) + (data.totalBuku || 0) + (data.totalBundle || 0), keterangan: 'Berkas + Buku + Bundle' },
        ],
      });

      // Sheet 2: Progres Mingguan
      if (data.weeklyProgress && data.weeklyProgress.length > 0) {
        const wp = data.weeklyProgress;
        const totalBerkas = wp.reduce((s, w) => s + (w.berkas || 0), 0);
        const totalBuku = wp.reduce((s, w) => s + (w.buku || 0), 0);
        const totalBundle = wp.reduce((s, w) => s + (w.bundle || 0), 0);

        sheets.push({
          sheetName: 'Progres Mingguan',
          title: 'PROGRES PEKERJAAN MINGGUAN',
          subtitle: 'Tren penyelesaian tugas per kategori',
          infoLines: [
            `Periode: ${wp.length} hari terakhir`,
            `Total: ${totalBerkas + totalBuku + totalBundle} item`,
          ],
          columns: [
            { header: 'No', key: 'no', width: 6, type: 'number' as const },
            { header: 'Tanggal', key: 'tanggal', width: 22, type: 'date' as const },
            { header: 'Berkas', key: 'berkas', width: 12, type: 'number' as const },
            { header: 'Buku', key: 'buku', width: 12, type: 'number' as const },
            { header: 'Bundle', key: 'bundle', width: 12, type: 'number' as const },
            { header: 'Total', key: 'total', width: 12, type: 'number' as const },
          ],
          data: wp.map((w, i) => ({
            no: i + 1,
            tanggal: new Date(w._id).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
            berkas: w.berkas || 0,
            buku: w.buku || 0,
            bundle: w.bundle || 0,
            total: (w.berkas || 0) + (w.buku || 0) + (w.bundle || 0),
          })),
          summaryRow: { no: '', tanggal: '', berkas: totalBerkas, buku: totalBuku, bundle: totalBundle, total: totalBerkas + totalBuku + totalBundle },
          summaryLabel: 'TOTAL',
        });
      }

      // Sheet 3: Distribusi Tugas
      if (data.workDistribution && data.workDistribution.length > 0) {
        const wd = data.workDistribution;
        const totalCount = wd.reduce((s, w) => s + (w.count || 0), 0);

        sheets.push({
          sheetName: 'Distribusi Tugas',
          title: 'DISTRIBUSI JENIS PEKERJAAN',
          subtitle: 'Sebaran tugas berdasarkan kategori',
          infoLines: [
            `Total Jenis: ${wd.length} kategori`,
            `Total Pekerjaan: ${totalCount} item`,
          ],
          columns: [
            { header: 'No', key: 'no', width: 6, type: 'number' as const },
            { header: 'Jenis Pekerjaan', key: 'jenis', width: 30 },
            { header: 'Jumlah', key: 'jumlah', width: 14, type: 'number' as const },
            { header: 'Persentase', key: 'persen', width: 14 },
          ],
          data: wd.map((w, i) => ({
            no: i + 1,
            jenis: w._id || 'Lainnya',
            jumlah: w.count || 0,
            persen: totalCount > 0 ? ((w.count || 0) / totalCount * 100).toFixed(1) + '%' : '0%',
          })),
          summaryRow: { no: '', jenis: '', jumlah: totalCount, persen: '100%' },
          summaryLabel: 'TOTAL',
        });
      }

      // Sheet 4: Top Peserta
      if (data.topPerformers && data.topPerformers.length > 0) {
        sheets.push({
          sheetName: 'Top Peserta',
          title: 'PERINGKAT PESERTA TERBAIK',
          subtitle: 'Berdasarkan total item yang diselesaikan',
          infoLines: [
            `Total: ${data.topPerformers.length} peserta`,
          ],
          columns: [
            { header: 'Peringkat', key: 'rank', width: 12, type: 'number' as const },
            { header: 'Nama Peserta', key: 'nama', width: 28 },
            { header: 'Institusi', key: 'instansi', width: 30 },
            { header: 'Total Item', key: 'totalItems', width: 14, type: 'number' as const },
          ],
          data: data.topPerformers.map((p, i) => ({
            rank: i + 1,
            nama: p.name || '-',
            instansi: p.instansi || '-',
            totalItems: p.totalItems || 0,
          })),
        });
      }

      // Sheet 5: Kehadiran Hari Ini
      if (attendanceList.length > 0) {
        const aktif = attendanceList.filter((r: any) => !r.jamKeluar).length;
        const keluar = attendanceList.filter((r: any) => r.jamKeluar).length;

        sheets.push({
          sheetName: 'Kehadiran Hari Ini',
          title: 'DAFTAR KEHADIRAN HARI INI',
          subtitle: todayStr,
          infoLines: [
            `Total Hadir: ${attendanceList.length} peserta`,
            `Aktif: ${aktif} | Sudah Keluar: ${keluar}`,
          ],
          columns: [
            { header: 'No', key: 'no', width: 6, type: 'number' as const },
            { header: 'Nama Peserta', key: 'nama', width: 28 },
            { header: 'Institusi', key: 'instansi', width: 30 },
            { header: 'Jam Masuk', key: 'jamMasuk', width: 14 },
            { header: 'Jam Keluar', key: 'jamKeluar', width: 14 },
            { header: 'Status', key: 'status', width: 14 },
          ],
          data: attendanceList.map((r: any, i: number) => ({
            no: i + 1,
            nama: r.userId?.name || 'Unknown',
            instansi: r.userId?.instansi || '-',
            jamMasuk: r.jamMasuk || '-',
            jamKeluar: r.jamKeluar || 'Belum Keluar',
            status: r.jamKeluar ? 'Selesai' : 'Aktif',
          })),
        });
      }

      // Sheet 6: Aktivitas Terbaru
      if (data.recentActivity && data.recentActivity.length > 0) {
        const ra = data.recentActivity;
        const totalB = ra.reduce((s: number, a: any) => s + (a.berkas || 0), 0);
        const totalK = ra.reduce((s: number, a: any) => s + (a.buku || 0), 0);
        const totalBd = ra.reduce((s: number, a: any) => s + (a.bundle || 0), 0);

        sheets.push({
          sheetName: 'Aktivitas Terbaru',
          title: 'AKTIVITAS PEKERJAAN TERBARU',
          subtitle: 'Update terkini dari peserta magang',
          infoLines: [
            `Total: ${ra.length} aktivitas`,
            `Berkas: ${totalB} | Buku: ${totalK} | Bundle: ${totalBd}`,
          ],
          columns: [
            { header: 'No', key: 'no', width: 6, type: 'number' as const },
            { header: 'Nama Peserta', key: 'nama', width: 24 },
            { header: 'Jenis Pekerjaan', key: 'jenis', width: 22 },
            { header: 'Berkas', key: 'berkas', width: 10, type: 'number' as const },
            { header: 'Buku', key: 'buku', width: 10, type: 'number' as const },
            { header: 'Bundle', key: 'bundle', width: 10, type: 'number' as const },
            { header: 'Tanggal', key: 'tanggal', width: 22, type: 'date' as const },
            { header: 'Keterangan', key: 'keterangan', width: 28 },
          ],
          data: ra.map((a: any, i: number) => ({
            no: i + 1,
            nama: typeof a.userId === 'string' ? 'Unknown' : a.userId?.name || 'Unknown',
            jenis: a.jenis || '-',
            berkas: a.berkas || 0,
            buku: a.buku || 0,
            bundle: a.bundle || 0,
            tanggal: new Date(a.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
            keterangan: a.keterangan || '-',
          })),
          summaryRow: { no: '', nama: '', jenis: '', berkas: totalB, buku: totalK, bundle: totalBd, tanggal: '', keterangan: '' },
          summaryLabel: 'TOTAL',
        });
      }

      await exportExcel({
        fileName: 'Dashboard_Monitoring',
        companyName: 'SISMON Magang',
        creator: 'Admin Dashboard',
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

    // Weekly chart
    if (weeklyRef.current) {
      const wp = data.weeklyProgress || [];
      const labels = wp.map((w) =>
        new Date(w._id).toLocaleDateString("id-ID", { weekday: "short" }),
      );
      const c = new Chart(weeklyRef.current, {
        type: "bar",
        data: {
          labels: labels.length ? labels : ["No data"],
          datasets: [
            {
              label: "Berkas",
              data: wp.map((w) => w.berkas),
              backgroundColor: "rgba(77,184,232,0.85)",
              borderRadius: 5,
              barPercentage: 0.5,
            },
            {
              label: "Buku",
              data: wp.map((w) => w.buku),
              backgroundColor: "rgba(139,92,246,0.85)",
              borderRadius: 5,
              barPercentage: 0.5,
            },
            {
              label: "Bundle",
              data: wp.map((w) => w.bundle),
              backgroundColor: "rgba(34,197,94,0.85)",
              borderRadius: 5,
              barPercentage: 0.5,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: true,
              position: "bottom",
              labels: {
                color: "#64748b",
                font: { size: 12 },
                usePointStyle: true,
                pointStyle: "circle",
                boxWidth: 8,
              },
            },
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

    // Donut chart — berkas, buku, bundle totals
    if (donutRef.current) {
      const totalBerkas = data.totalBerkas || 0;
      const totalBuku = data.totalBuku || 0;
      const totalBundle = data.totalBundle || 0;
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
      <div className="page-header-row">
        <div className="page-header">
          <h1>Dashboard Monitoring</h1>
          <p>Overview produktivitas dan kehadiran peserta magang</p>
        </div>
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
      <div className="admin-stats-grid">
        <div className="admin-stat-card">
          <div className="stat-info">
            <div className="stat-label">Total Kendala</div>
            <div className="stat-value stat-value-cyan">{totalComplaints}</div>
            <div className="stat-change">
              <span>Laporan keluhan masuk</span>
            </div>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-info">
            <div className="stat-label">Total Peserta Magang</div>
            <div
              className="stat-value"
              ref={(el) => {
                if (el && data) animateCounter(el, data.totalPeserta || 0);
              }}
            ></div>
            <div className="stat-change">
              <span>Semua aktif</span>
            </div>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-info">
            <div className="stat-label">Rata-rata Produktivitas</div>
            <div
              className="stat-value stat-value-yellow"
              ref={(el) => {
                if (el && data) animateCounter(el, data.avgProductivity || 0);
              }}
            ></div>
            <div className="stat-change">
              <span>Item/hari per orang</span>
            </div>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-info">
            <div className="stat-label">Kehadiran Hari Ini</div>
            <div className="stat-value stat-value-red">
              {data.attendanceRate}%
            </div>
            <div className="stat-change">
              <span>
                {data.todayAttendance}/{data.totalPeserta} Hadir
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="charts-row">
        <div className="chart-card">
          <div className="chart-header">
            <h3>Progres Pekerjaan Mingguan</h3>
            <p>Tren penyelesaian tugas per kategori</p>
          </div>
          <div className="chart-canvas-wrapper">
            <canvas ref={weeklyRef} />
          </div>
        </div>
        <div className="chart-card">
          <div className="chart-header">
            <h3>Kategori Arsip</h3>
            <p>Total keseluruhan berkas, buku, dan bundle</p>
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
