import React, { useEffect, useState, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import * as XLSX from 'xlsx';
import { DashboardAPI, getToken, ComplaintAPI } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import type { AdminDashboard as AdminDashData } from '../../types';

Chart.register(...registerables);

function animateCounter(el: HTMLElement | null, target: number, suffix = '') {
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
  if (mins < 1) return 'Baru saja';
  if (mins < 60) return mins + ' menit lalu';
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours + ' jam lalu';
  return Math.floor(hours / 24) + ' hari lalu';
}

const AdminDashboard: React.FC = () => {
  const { showToast } = useToast();
  const [data, setData] = useState<AdminDashData | null>(null);
  const [attendanceList, setAttendanceList] = useState<any[]>([]);
  const [totalComplaints, setTotalComplaints] = useState(0);
  const weeklyRef = useRef<HTMLCanvasElement>(null);
  const donutRef = useRef<HTMLCanvasElement>(null);
  const attChartRef = useRef<HTMLCanvasElement>(null);
  const charts = useRef<Chart[]>([]);

  useEffect(() => {
    DashboardAPI.getAdmin().then((res) => {
      if (res && res.success) setData(res.data);
      else showToast('Gagal memuat dashboard', 'error');
    });

    // Load total complaints
    loadComplaints();

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
      console.error('Failed to load complaints');
    }
  };

  const loadAttendance = async () => {
    try {
      const res = await fetch('/api/attendance/today', { headers: { Authorization: 'Bearer ' + getToken() } });
      const d = await res.json();
      if (d.success) setAttendanceList(d.data || []);
    } catch { }
  };

  const exportToExcel = () => {
    if (!data) {
      showToast('Data tidak tersedia', 'error');
      return;
    }

    try {
      const workbook = XLSX.utils.book_new();

      // Sheet 1: Summary Stats
      const summaryData = [
        ['RINGKASAN DASHBOARD PESERTA MAGANG', ''],
        [''],
        ['Total Kendala', totalComplaints],
        ['Total Peserta Magang', data.totalPeserta || 0],
        ['Rata-rata Produktivitas (Item/hari)', data.avgProductivity || 0],
        ['Tingkat Kehadiran Hari Ini', (data.attendanceRate || 0) + '%'],
        ['Peserta Hadir Hari Ini', (data.todayAttendance || 0) + '/' + (data.totalPeserta || 0)],
      ];
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      summarySheet['!cols'] = [{ wch: 30 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Ringkasan');

      // Sheet 2: Weekly Progress
      if (data.weeklyProgress && data.weeklyProgress.length > 0) {
        const weeklyHeaders = ['Tanggal', 'Berkas', 'Buku', 'Bundle'];
        const weeklyData = data.weeklyProgress.map((w) => [new Date(w._id).toLocaleDateString('id-ID'), w.berkas || 0, w.buku || 0, w.bundle || 0]);
        const weeklySheet = XLSX.utils.aoa_to_sheet([weeklyHeaders, ...weeklyData]);
        weeklySheet['!cols'] = [{ wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
        XLSX.utils.book_append_sheet(workbook, weeklySheet, 'Progres Mingguan');
      }

      // Sheet 3: Work Distribution
      if (data.workDistribution && data.workDistribution.length > 0) {
        const distHeaders = ['Jenis Pekerjaan', 'Jumlah'];
        const distData = data.workDistribution.map((w) => [w._id || 'Lainnya', w.count || 0]);
        const distSheet = XLSX.utils.aoa_to_sheet([distHeaders, ...distData]);
        distSheet['!cols'] = [{ wch: 30 }, { wch: 15 }];
        XLSX.utils.book_append_sheet(workbook, distSheet, 'Distribusi Tugas');
      }

      // Sheet 4: Top Performers
      if (data.topPerformers && data.topPerformers.length > 0) {
        const perfHeaders = ['Peringkat', 'Nama Peserta', 'Total Item', 'Institusi'];
        const perfData = data.topPerformers.map((p, i) => [i + 1, p.name || '-', p.totalItems || 0, p.instansi || '-']);
        const perfSheet = XLSX.utils.aoa_to_sheet([perfHeaders, ...perfData]);
        perfSheet['!cols'] = [{ wch: 12 }, { wch: 25 }, { wch: 15 }, { wch: 30 }];
        XLSX.utils.book_append_sheet(workbook, perfSheet, 'Top Peserta');
      }

      // Sheet 5: Today's Attendance
      if (attendanceList.length > 0) {
        const attHeaders = ['No', 'Nama Peserta', 'Institusi', 'Jam Masuk', 'Jam Keluar', 'Status'];
        const attData = attendanceList.map((r, i) => [i + 1, r.userId?.name || 'Unknown', r.userId?.instansi || '-', r.jamMasuk || '-', r.jamKeluar || 'Belum Keluar', r.jamKeluar ? 'Keluar' : 'Aktif']);
        const attSheet = XLSX.utils.aoa_to_sheet([attHeaders, ...attData]);
        attSheet['!cols'] = [{ wch: 8 }, { wch: 25 }, { wch: 30 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
        XLSX.utils.book_append_sheet(workbook, attSheet, 'Kehadiran Hari Ini');
      }

      // Sheet 6: Recent Activity
      if (data.recentActivity && data.recentActivity.length > 0) {
        const actHeaders = ['No', 'Nama Peserta', 'Jenis Pekerjaan', 'Berkas', 'Buku', 'Bundle', 'Tanggal', 'Keterangan'];
        const actData = data.recentActivity.map((a, i) => {
          const userName = typeof a.userId === 'string' ? 'Unknown' : a.userId?.name || 'Unknown';
          return [i + 1, userName, a.jenis || '-', a.berkas || 0, a.buku || 0, a.bundle || 0, new Date(a.createdAt).toLocaleDateString('id-ID'), a.keterangan || '-'];
        });
        const actSheet = XLSX.utils.aoa_to_sheet([actHeaders, ...actData]);
        actSheet['!cols'] = [{ wch: 8 }, { wch: 25 }, { wch: 25 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 15 }, { wch: 20 }];
        XLSX.utils.book_append_sheet(workbook, actSheet, 'Aktivitas Terbaru');
      }

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `Dashboard-Monitoring-${timestamp}.xlsx`;

      // Write file
      XLSX.writeFile(workbook, filename);
      showToast('Data berhasil diekspor ke Excel', 'success');
    } catch (error) {
      console.error('Export error:', error);
      showToast('Gagal mengekspor data', 'error');
    }
  };

  useEffect(() => {
    if (!data) return;
    charts.current.forEach((c) => c.destroy());
    charts.current = [];

    // Weekly chart
    if (weeklyRef.current) {
      const wp = data.weeklyProgress || [];
      const labels = wp.map((w) => new Date(w._id).toLocaleDateString('id-ID', { weekday: 'short' }));
      const c = new Chart(weeklyRef.current, {
        type: 'bar',
        data: {
          labels: labels.length ? labels : ['No data'],
          datasets: [
            { label: 'Berkas', data: wp.map((w) => w.berkas), backgroundColor: 'rgba(77,184,232,0.85)', borderRadius: 5, barPercentage: 0.5 },
            { label: 'Buku', data: wp.map((w) => w.buku), backgroundColor: 'rgba(139,92,246,0.85)', borderRadius: 5, barPercentage: 0.5 },
            { label: 'Bundle', data: wp.map((w) => w.bundle), backgroundColor: 'rgba(34,197,94,0.85)', borderRadius: 5, barPercentage: 0.5 },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: true, position: 'bottom', labels: { color: '#64748b', font: { size: 12 }, usePointStyle: true, pointStyle: 'circle', boxWidth: 8 } },
            tooltip: { backgroundColor: '#fff', titleColor: '#1e293b', bodyColor: '#64748b', borderColor: '#e2e8f0', borderWidth: 1, cornerRadius: 10, padding: 12 },
          },
          scales: { x: { grid: { display: false }, ticks: { color: '#94a3b8' } }, y: { grid: { color: 'rgba(226,232,240,0.5)' }, ticks: { color: '#94a3b8' }, beginAtZero: true } },
        },
      });
      charts.current.push(c);
    }

    // Donut chart
    if (donutRef.current) {
      const wd = data.workDistribution || [];
      const colors = ['#4db8e8', '#0a6599', '#8b5cf6', '#22c55e', '#fb923c', '#ffd600', '#ef4444', '#ec4899'];
      const c = new Chart(donutRef.current, {
        type: 'doughnut',
        data: { labels: wd.map((w) => w._id || 'Lainnya'), datasets: [{ data: wd.map((w) => w.count), backgroundColor: colors.slice(0, wd.length), borderWidth: 3, borderColor: '#fff', hoverOffset: 8 }] },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '68%',
          plugins: { legend: { display: false }, tooltip: { backgroundColor: '#fff', titleColor: '#1e293b', bodyColor: '#64748b', borderColor: '#e2e8f0', borderWidth: 1, cornerRadius: 10, padding: 12 } },
        },
      });
      charts.current.push(c);
    }

    // Attendance line chart
    if (attChartRef.current) {
      const total = data.totalPeserta || 1;
      const today = data.todayAttendance || 0;
      const labels = ['07:00', '07:30', '08:00', '08:30', '09:00'];
      const step = today / labels.length;
      const vals = labels.map((_, i) => Math.min(Math.round(step * (i + 1)), today));
      const c = new Chart(attChartRef.current, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Kehadiran',
              data: vals,
              fill: true,
              backgroundColor: 'rgba(46,213,115,0.15)',
              borderColor: '#2ed573',
              borderWidth: 3,
              tension: 0.4,
              pointRadius: 4,
              pointBackgroundColor: '#2ed573',
              pointBorderColor: '#fff',
              pointBorderWidth: 2,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { x: { grid: { color: 'rgba(226,232,240,0.3)' }, ticks: { color: '#94a3b8' } }, y: { grid: { color: 'rgba(226,232,240,0.3)' }, ticks: { color: '#94a3b8' }, beginAtZero: true, max: Math.max(total + 2, 5) } },
        },
      });
      charts.current.push(c);
    }
  }, [data]);

  if (!data) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--gray-400)' }}>Memuat dashboard...</div>;

  const tp = data.topPerformers || [];
  const maxItems = tp.length > 0 ? tp[0].totalItems || 1 : 1;
  const ra = data.recentActivity || [];
  const wd = data.workDistribution || [];
  const colors = ['#4db8e8', '#0a6599', '#8b5cf6', '#22c55e', '#fb923c', '#ffd600', '#ef4444', '#ec4899'];

  return (
    <>
      <div className="page-header-row">
        <div className="page-header">
          <h1>Dashboard Monitoring</h1>
          <p>Overview produktivitas dan kehadiran peserta magang</p>
        </div>
        <button className="btn-export" onClick={exportToExcel} title="Ekspor ke Excel">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
            <div className="stat-value stat-value-red">{data.attendanceRate}%</div>
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
            <h3>Distribusi Jenis Tugas</h3>
            <p>Proporsi beban kerja minggu ini</p>
          </div>
          <div className="chart-canvas-wrapper" style={{ height: 220 }}>
            <canvas ref={donutRef} />
          </div>
          <div className="donut-legend">
            {wd.map((w, i) => (
              <div key={w._id} className="legend-item">
                <span className="legend-dot" style={{ background: colors[i % colors.length] }} />
                {w._id || 'Lainnya'}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="charts-row-2">
        <div className="chart-card">
          <div className="chart-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span style={{ fontSize: 20 }}>🏅</span>
              <h3>Top 5 Peserta Terrajin</h3>
            </div>
            <p>Berdasarkan jumlah tugas</p>
          </div>
          <div className="top-performer-list">
            {tp.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 20 }}>Belum ada data</p>
            ) : (
              tp.map((p, i) => {
                const pct = Math.round((p.totalItems / maxItems) * 100);
                return (
                  <div key={i} className="top-performer-item">
                    <span className="tp-name">
                      {p.name} <small style={{ color: 'var(--gray-400)' }}>({p.totalItems} item)</small>
                    </span>
                    <div className="tp-bar-wrap">
                      <div className="tp-bar" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
        <div className="chart-card">
          <div className="chart-header">
            <h3>Distribusi Kehadiran Hari Ini</h3>
            <p>Grafik akumulasi kedatangan</p>
          </div>
          <div className="attendance-chart-wrapper">
            <canvas ref={attChartRef} />
          </div>
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
          <div style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>Belum ada peserta yang absen hari ini</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {attendanceList.map((r: any, i: number) => {
              const name = r.userId?.name || 'Unknown';
              const initials = name
                .split(' ')
                .map((n: string) => n[0])
                .join('')
                .substring(0, 2)
                .toUpperCase();
              return (
                <div key={r._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fafc', borderRadius: 10, border: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg,#0a6599,#4db8e8)',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {initials}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{name}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>{r.userId?.instansi || '-'}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#0a6599' }}>{r.jamMasuk || '-'}</div>
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
            <p style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 30 }}>Belum ada aktivitas</p>
          ) : (
            ra.map((a: any, i: number) => {
              const name = a.userId?.name || 'Unknown';
              return (
                <div key={a._id || i} className="activity-feed-item" style={{ animationDelay: `${i * 0.08}s` }}>
                  <div className="afi-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  </div>
                  <div className="afi-content">
                    <div className="afi-name">{name}</div>
                    <div className="afi-desc">
                      {a.jenis}: {a.berkas} berkas, {a.buku} buku, {a.bundle} bundle
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
