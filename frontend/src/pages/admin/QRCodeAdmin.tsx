import React, { useEffect, useState, useRef } from 'react';
import { QRCodeAPI, UsersAPI, getToken } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import type { QRCode } from '../../types';
import QRCodeLib from 'qrcode';
import './QRCodeAdmin.css';

const QRCodeAdmin: React.FC = () => {
  const { showToast } = useToast();
  const [todayQR, setTodayQR] = useState<QRCode | null>(null);
  const [history, setHistory] = useState<QRCode[]>([]);
  const [totalPeserta, setTotalPeserta] = useState(0);
  const [attendanceList, setAttendanceList] = useState<any[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const load = async () => {
    const qr = await QRCodeAPI.getToday();
    if (qr && qr.success && qr.data) {
      setTodayQR(qr.data);
      if (canvasRef.current) {
        const url = window.location.origin + '/absensi-scan?token=' + qr.data.token;
        QRCodeLib.toCanvas(canvasRef.current, url, { width: 220, color: { dark: '#0a6599' } });
      }
    }
    const hist = await QRCodeAPI.getHistory();
    if (hist && hist.success) setHistory(hist.data || []);
    const users = await UsersAPI.getAll();
    if (users && users.success) setTotalPeserta(users.data.length);
    loadAttendance();
  };

  const loadAttendance = async () => {
    try {
      const res = await fetch('/api/attendance/today', { headers: { Authorization: 'Bearer ' + getToken() } });
      const d = await res.json();
      if (d.success) setAttendanceList(d.data || []);
    } catch {}
  };

  useEffect(() => {
    load();
    const iv = setInterval(loadAttendance, 15000);
    return () => clearInterval(iv);
  }, []);

  const handleCopyToken = async () => {
    if (!todayQR?.token) return;
    try {
      await navigator.clipboard.writeText(todayQR.token);
      showToast('Token berhasil disalin!', 'success');
    } catch {
      showToast('Gagal menyalin token', 'error');
    }
  };

  const handleGenerate = async () => {
    const res = await QRCodeAPI.generate();
    if (res && res.success) {
      showToast('QR Code berhasil di-generate!', 'success');
      load();
    } else showToast(res?.message || 'Gagal generate', 'error');
  };

  const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <>
      <div className="page-header">
        <h1>Kelola QR Code</h1>
        <p>Generate QR Code untuk absensi harian peserta magang</p>
      </div>
      <div className="qr-date-bar">
        <div className="date-info">
          <div className="date-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
              <line x1="16" x2="16" y1="2" y2="6" />
              <line x1="8" x2="8" y1="2" y2="6" />
              <line x1="3" x2="21" y1="10" y2="10" />
            </svg>
          </div>
          <div className="date-text">
            <h3>{today}</h3>
            <p>Generate QR Code untuk hari ini</p>
          </div>
        </div>
      </div>
      <div className="qr-layout">
        <div className="qr-gen-card">
          <div className="qr-gen-header">
            <h3>Generate QR Code</h3>
          </div>
          <p className="qr-gen-sub">QR Code akan berlaku untuk hari ini saja</p>
          <div className="qr-preview-admin">{todayQR ? <canvas ref={canvasRef} /> : <span className="qr-preview-text">Klik tombol di bawah untuk generate</span>}</div>
          {todayQR && (
            <div className="qr-token-container">
              <div className="qr-token-text">
                <strong>Token:</strong>
                <code className="qr-token-code">{todayQR.token}</code>
              </div>
              <button onClick={handleCopyToken} className="qr-copy-btn" title="Salin token ke clipboard">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                  <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                </svg>
                Copy
              </button>
            </div>
          )}
          <button className="btn btn-primary btn-full" onClick={handleGenerate} style={{ marginTop: 8 }}>
            Generate QR Code
          </button>
        </div>
        <div>
          <div className="qr-status-card">
            <div className="qr-status-header">
              <h3>Status QR Code Hari Ini</h3>
            </div>
            <div className="qr-status-counts">
              <div className="qr-count-box total">
                <div className="qr-count-box-value">{totalPeserta}</div>
                <div className="qr-count-box-label">Total Peserta</div>
              </div>
              <div className="qr-count-box scanned">
                <div className="qr-count-box-value">{todayQR?.scannedBy?.length || attendanceList.length || 0}</div>
                <div className="qr-count-box-label">Sudah Absen</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="qr-history-card">
        <h3>Daftar Kehadiran Hari Ini</h3>
        {attendanceList.length === 0 ? (
          <p className="qr-history-empty">Belum ada peserta absen</p>
        ) : (
          <table className="qr-attendance-table">
            <thead>
              <tr>
                <th>No</th>
                <th>Nama</th>
                <th>Jam Masuk</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {attendanceList.map((r: any, i: number) => (
                <tr key={r._id}>
                  <td>{i + 1}</td>
                  <td className="qr-attendance-name">{r.userId?.name || 'Unknown'}</td>
                  <td className="qr-attendance-time">{r.jamMasuk || '-'}</td>
                  <td>
                    <span className="qr-status-badge">{r.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="qr-history-card">
        <h3>Riwayat QR Code</h3>
        <p className="qr-history-subtitle">7 hari terakhir</p>
        {history.length === 0 ? (
          <p className="qr-history-empty">Belum ada riwayat</p>
        ) : (
          history.map((h) => {
            const dt = new Date(h.tanggal).toLocaleDateString('id-ID', {
              weekday: 'long',
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            });
            return (
              <div key={h._id} className="qr-history-item">
                <div className="qr-history-date">{dt}</div>
                <div className="qr-history-count">
                  <span className="qr-history-count-value">{h.scannedCount || 0}</span>
                  <span className="qr-history-count-label">scan</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
};

export default QRCodeAdmin;
