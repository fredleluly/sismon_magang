import React, { useEffect, useState, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import { DashboardAPI } from '../../services/api';
import type { UserDashboard, WorkLog, WeeklyProgress, WorkDistribution } from '../../types';

Chart.register(...registerables);

const JOB_COLORS: Record<string, string> = {
  'Sortir Dokumen': '#4db8e8', 'Registering': '#0a6599', 'Melepas Step': '#8b5cf6',
  'Scanning': '#22c55e', 'Menyusun ke Kardus': '#fb923c', 'Stikering': '#ffd600',
  'Melakukan Scanning': '#22c55e', 'Menginput data arsipan (Registering)': '#0a6599',
  'Menyusun arsip kedalam kardus': '#fb923c', 'Lainnya': '#94a3b8',
};

function animateCounter(el: HTMLElement | null, target: number) {
  if (!el) return;
  const duration = 1000;
  const start = parseInt(el.textContent || '0') || 0;
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
  const [data, setData] = useState<UserDashboard | null>(null);
  const weeklyRef = useRef<HTMLCanvasElement>(null);
  const donutRef = useRef<HTMLCanvasElement>(null);
  const weeklyChart = useRef<Chart | null>(null);
  const donutChart = useRef<Chart | null>(null);
  const berkasRef = useRef<HTMLDivElement>(null);
  const bukuRef = useRef<HTMLDivElement>(null);
  const bundleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    DashboardAPI.getUser().then(res => {
      if (res && res.success) setData(res.data);
    });
  }, []);

  useEffect(() => {
    if (!data) return;
    animateCounter(berkasRef.current, data.totalBerkas || 0);
    animateCounter(bukuRef.current, data.totalBuku || 0);
    animateCounter(bundleRef.current, data.totalBundle || 0);

    // Weekly Chart
    if (weeklyRef.current) {
      if (weeklyChart.current) weeklyChart.current.destroy();
      const wp = data.weeklyProgress || [];
      const labels = wp.map(w => { const d = new Date(w._id); return d.toLocaleDateString('id-ID', { weekday: 'short' }); });
      weeklyChart.current = new Chart(weeklyRef.current, {
        type: 'bar',
        data: {
          labels: labels.length ? labels : ['Sen','Sel','Rab','Kam','Jum'],
          datasets: [
            { label: 'Berkas', data: wp.map(w=>w.berkas||0), backgroundColor: 'rgba(77,184,232,0.85)', borderRadius: 6, barPercentage: 0.65 },
            { label: 'Buku', data: wp.map(w=>w.buku||0), backgroundColor: 'rgba(255,214,0,0.85)', borderRadius: 6, barPercentage: 0.65 },
            { label: 'Bundle', data: wp.map(w=>w.bundle||0), backgroundColor: 'rgba(34,197,94,0.85)', borderRadius: 6, barPercentage: 0.65 },
          ],
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true, position: 'bottom', labels: { color: '#64748b', font: { size: 11 }, usePointStyle: true, pointStyle: 'circle', boxWidth: 8 } }, tooltip: { backgroundColor: '#fff', titleColor: '#1e293b', bodyColor: '#64748b', borderColor: '#e2e8f0', borderWidth: 1, cornerRadius: 10, padding: 12 } }, scales: { x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { weight: 'bold' as const } } }, y: { grid: { color: 'rgba(226,232,240,0.5)' }, ticks: { color: '#94a3b8' }, beginAtZero: true } } },
      });
    }

    // Donut Chart
    if (donutRef.current) {
      if (donutChart.current) donutChart.current.destroy();
      const wd = data.workDistribution || [];
      const labels = wd.map(w => w._id || 'Lainnya');
      const vals = wd.map(w => w.count || 0);
      const colors = labels.map(l => JOB_COLORS[l] || '#94a3b8');
      donutChart.current = new Chart(donutRef.current, {
        type: 'doughnut',
        data: { labels: labels.length ? labels : ['Belum ada data'], datasets: [{ data: vals.length ? vals : [1], backgroundColor: vals.length ? colors : ['#e2e8f0'], borderWidth: 3, borderColor: '#fff', hoverOffset: 8 }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { display: false }, tooltip: { backgroundColor: '#fff', titleColor: '#1e293b', bodyColor: '#64748b', borderColor: '#e2e8f0', borderWidth: 1, cornerRadius: 10, padding: 12 } } },
      });
    }

    return () => { weeklyChart.current?.destroy(); donutChart.current?.destroy(); };
  }, [data]);

  const renderActivity = () => {
    if (!data?.recentActivity?.length) return <div style={{textAlign:'center',padding:40,color:'var(--gray-400)'}}>Belum ada aktivitas. Mulai input pekerjaan Anda!</div>;
    return (
      <table className="activity-table">
        <thead><tr><th>Tanggal</th><th>Jenis Pekerjaan</th><th>Keterangan</th><th>Jumlah</th><th>Status</th></tr></thead>
        <tbody>{data.recentActivity.slice(0,10).map((log: WorkLog, i: number) => {
          const date = new Date(log.tanggal).toLocaleDateString('id-ID');
          const jumlah = [log.berkas && `${log.berkas} Berkas`, log.buku && `${log.buku} Buku`, log.bundle && `${log.bundle} Bundle`].filter(Boolean).join(', ');
          return <tr key={log._id} style={{animation:`fadeInUp 0.3s ease ${i*0.05}s both`}}><td>{date}</td><td>{log.jenis||'-'}</td><td>{log.keterangan||'-'}</td><td>{jumlah||'-'}</td><td><span className="status-badge selesai">Selesai</span></td></tr>;
        })}</tbody>
      </table>
    );
  };

  const wd = data?.workDistribution || [];
  const donutLabels = wd.map(w => w._id || 'Lainnya');
  const donutColors = donutLabels.map(l => JOB_COLORS[l] || '#94a3b8');

  return (
    <>
      <div className="page-header"><h1>Dashboard</h1><p>Selamat datang kembali! Berikut ringkasan progres harian Anda.</p></div>
      <div className="stats-grid">
        <div className="stat-card"><div className="stat-info"><div className="stat-label">Total Berkas</div><div className="stat-value" ref={berkasRef}>0</div><div className="stat-change"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg><span>+12% dari minggu lalu</span></div></div><div className="stat-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg></div></div>
        <div className="stat-card"><div className="stat-info"><div className="stat-label">Total Buku</div><div className="stat-value" ref={bukuRef}>0</div><div className="stat-change"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg><span>+8% dari minggu lalu</span></div></div><div className="stat-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg></div></div>
        <div className="stat-card"><div className="stat-info"><div className="stat-label">Total Bundle</div><div className="stat-value" ref={bundleRef}>0</div><div className="stat-change"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg><span>+15% dari minggu lalu</span></div></div><div className="stat-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg></div></div>
      </div>
      <div className="charts-row">
        <div className="chart-card"><div className="chart-header"><h3>Progres Kerja (Mingguan)</h3><p>Jumlah item yang diproses per hari</p></div><div className="chart-canvas-wrapper"><canvas ref={weeklyRef} /></div></div>
        <div className="chart-card"><div className="chart-header"><h3>Distribusi Pekerjaan</h3><p>Rincian jenis pekerjaan</p></div><div className="chart-canvas-wrapper" style={{height:220}}><canvas ref={donutRef} /></div>
          <div className="donut-legend">{donutLabels.map((l,i) => <div key={l} className="legend-item"><span className="legend-dot" style={{background:donutColors[i]}} />{l}</div>)}</div>
        </div>
      </div>
      <div className="activity-card"><div className="activity-header"><div><h3>Aktivitas Terbaru</h3><p>Log pekerjaan terbaru Anda</p></div></div>{renderActivity()}</div>
    </>
  );
};

export default Dashboard;
