import React, { useEffect, useState, useRef, useCallback } from 'react';
import { AttendanceAPI } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import type { Attendance } from '../../types';

const Absensi: React.FC = () => {
  const { showToast } = useToast();
  const [records, setRecords] = useState<Attendance[]>([]);
  const [tab, setTab] = useState<'camera' | 'manual'>('camera');
  const [tokenInput, setTokenInput] = useState('');
  const [scanStatus, setScanStatus] = useState('Klik tombol di bawah untuk mulai scan');
  const [scanning, setScanning] = useState(false);
  const [lateThreshold, setLateThreshold] = useState<string>('08:00');
  const [showLateWarning, setShowLateWarning] = useState(false);
  const [pendingToken, setPendingToken] = useState<string>('');
  const scannerRef = useRef<any>(null);

  const loadData = useCallback(async () => {
    const res = await AttendanceAPI.getAll();
    if (res && res.success) setRecords(res.data || []);
  }, []);

  // Load late threshold from backend or localStorage
  useEffect(() => {
    const loadThreshold = async () => {
      try {
        const res = await AttendanceAPI.getLateThreshold();
        if (res && res.success) {
          setLateThreshold(res.data.lateThreshold);
        } else {
          // Fallback to localStorage
          const saved = localStorage.getItem('lateThreshold');
          if (saved) setLateThreshold(saved);
        }
      } catch {
        // If error, use localStorage fallback
        const saved = localStorage.getItem('lateThreshold');
        if (saved) setLateThreshold(saved);
      }
    };
    loadThreshold();
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Helper function to check if time is late
  const isLate = (jamMasuk: string | null | undefined): boolean => {
    if (!jamMasuk) return false;
    try {
      const normalized = jamMasuk.replace('.', ':');
      const [masukHours, masukMinutes] = normalized.split(':').map(Number);
      const [thresholdHours, thresholdMinutes] = lateThreshold.split(':').map(Number);
      const masukTime = masukHours * 60 + masukMinutes;
      const thresholdTime = thresholdHours * 60 + thresholdMinutes;
      return masukTime > thresholdTime;
    } catch {
      return false;
    }
  };

  // Helper function to check if current time is late
  const isCurrentTimeLate = (): boolean => {
    try {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const currentTimeStr = `${hours}:${minutes}`;

      const [currentHours, currentMinutes] = currentTimeStr.split(':').map(Number);
      const [thresholdHours, thresholdMinutes] = lateThreshold.split(':').map(Number);

      const currentTime = currentHours * 60 + currentMinutes;
      const thresholdTime = thresholdHours * 60 + thresholdMinutes;

      return currentTime > thresholdTime;
    } catch {
      return false;
    }
  };

  // Handle attendance submission with late check
  const handleAbsensiWithLateCheck = async (token: string) => {
    if (isCurrentTimeLate()) {
      setPendingToken(token);
      setShowLateWarning(true);
    } else {
      await submitAbsensi(token);
    }
  };

  // Proceed with attendance even if late
  const handleProceedAnyway = async () => {
    setShowLateWarning(false);
    await submitAbsensi(pendingToken);
    setPendingToken('');
  };

  const submitAbsensi = async (token: string) => {
    const res = await AttendanceAPI.scan(token);
    if (res && res.success) {
      showToast('Absensi berhasil!', 'success');
      setScanStatus('✅ Absensi berhasil tercatat!');
      loadData();
    } else {
      showToast(res?.message || 'Gagal absensi.', 'error');
      setScanStatus('❌ ' + (res?.message || 'Gagal'));
    }
  };

  const startScan = async () => {
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode('qrScannerContainer');
      scannerRef.current = scanner;
      setScanStatus('Mengaktifkan kamera...');
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (text: string) => {
          await scanner.stop();
          scanner.clear();
          setScanning(false);
          let token = '';
          try {
            if (text.includes('token=')) {
              token = new URL(text).searchParams.get('token') || '';
            } else {
              const p = JSON.parse(text);
              token = p.token || '';
            }
          } catch {
            token = text.trim();
          }
          if (token) await handleAbsensiWithLateCheck(token);
          else {
            showToast('QR Code tidak valid.', 'error');
            setScanStatus('QR Code tidak valid.');
          }
        },
        () => {},
      );
      setScanning(true);
      setScanStatus('Arahkan kamera ke QR Code...');
    } catch (err) {
      setScanStatus('Gagal akses kamera. Gunakan input manual.');
      showToast('Gagal akses kamera.', 'error');
    }
  };

  const stopScan = () => {
    if (scannerRef.current && scanning) {
      scannerRef.current
        .stop()
        .then(() => {
          scannerRef.current.clear();
        })
        .catch(() => {});
    }
    setScanning(false);
    setScanStatus('Klik tombol untuk mulai scan');
  };

  const handleManualSubmit = async () => {
    if (!tokenInput.trim()) {
      showToast('Masukkan token QR Code.', 'error');
      return;
    }
    await submitAbsensi(tokenInput.trim());
    setTokenInput('');
  };

  const now = new Date();
  const dateStr = now.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const lastTime = records.length > 0 && records[0].jamMasuk ? records[0].jamMasuk + ' WIB' : '--:-- WIB';

  return (
    <>
      <div className="absensi-date-bar">
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
            <h3>{dateStr}</h3>
            <p>Jam masuk: 08:00 - 09:00 WIB</p>
          </div>
        </div>
        <div className="last-absensi">
          <span>Absensi terakhir</span>
          <span className="time">{lastTime}</span>
        </div>
      </div>
      <div className="qr-section">
        <div className="qr-icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect width="5" height="5" x="3" y="3" rx="1" />
            <rect width="5" height="5" x="16" y="3" rx="1" />
            <rect width="5" height="5" x="3" y="16" rx="1" />
          </svg>
        </div>
        <h3>Absensi via QR Code</h3>
        <p>Scan QR Code dari admin atau masukkan token secara manual</p>
        <div style={{ display: 'flex', gap: 8, margin: '16px 0 12px', background: 'var(--gray-100)', borderRadius: 'var(--radius-md)', padding: 4 }}>
          <button
            className={tab === 'camera' ? 'btn btn-primary' : 'btn-outline'}
            style={{ flex: 1, padding: '8px 12px', fontSize: 13, borderRadius: 'var(--radius-sm)', background: tab === 'camera' ? '' : 'transparent' }}
            onClick={() => {
              setTab('camera');
            }}
          >
            Scan Kamera
          </button>
          <button
            className={tab === 'manual' ? 'btn btn-primary' : 'btn-outline'}
            style={{ flex: 1, padding: '8px 12px', fontSize: 13, borderRadius: 'var(--radius-sm)', background: tab === 'manual' ? '' : 'transparent' }}
            onClick={() => {
              setTab('manual');
              stopScan();
            }}
          >
            Input Manual
          </button>
        </div>
        {tab === 'camera' && (
          <div style={{ margin: '12px 0' }}>
            <div id="qrScannerContainer" style={{ width: '100%', maxWidth: 350, margin: '0 auto', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '2px solid var(--gray-200)' }} />
            <p style={{ textAlign: 'center', marginTop: 10, fontSize: 13, color: 'var(--gray-400)' }}>{scanStatus}</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
              {!scanning ? (
                <button className="btn btn-primary" onClick={startScan}>
                  Mulai Scan
                </button>
              ) : (
                <button className="btn-outline" onClick={stopScan}>
                  Stop
                </button>
              )}
            </div>
          </div>
        )}
        {tab === 'manual' && (
          <div style={{ margin: '16px 0' }}>
            <div className="input-wrapper" style={{ marginBottom: 12 }}>
              <span className="input-icon">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect width="5" height="5" x="3" y="3" rx="1" />
                  <rect width="5" height="5" x="16" y="3" rx="1" />
                  <rect width="5" height="5" x="3" y="16" rx="1" />
                </svg>
              </span>
              <input
                type="text"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Paste token QR Code di sini..."
                style={{ width: '100%', padding: '12px 12px 12px 40px', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-md)', fontSize: 14 }}
              />
            </div>
            <button className="btn btn-primary btn-full" onClick={() => handleAbsensiWithLateCheck(tokenInput.trim())}>
              Kirim Absensi
            </button>
          </div>
        )}
      </div>

      {/* Late Warning Modal */}
      {showLateWarning && (
        <div className="late-warning-overlay">
          <div className="late-warning-modal">
            <div className="late-warning-icon">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="2">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
              </svg>
            </div>
            <h3>⏰ Anda Sedang Telat!</h3>
            <p>Waktu saat ini melampaui batas jam absensi ({lateThreshold}).</p>
            <p className="warning-message">Anda tetap bisa melakukan absensi, namun akan dicatat sebagai "Telat"</p>
            <div className="late-warning-buttons">
              <button className="btn-cancel" onClick={() => setShowLateWarning(false)}>
                Batal
              </button>
              <button className="btn-proceed" onClick={handleProceedAnyway}>
                Absen Tetap
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="absensi-history">
        <h3>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>{' '}
          Riwayat Absensi
        </h3>
        <p className="history-sub">7 hari terakhir</p>
        <table className="history-table">
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Jam Masuk</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr>
                <td colSpan={3} style={{ textAlign: 'center', padding: 20, color: 'var(--gray-400)' }}>
                  Belum ada riwayat
                </td>
              </tr>
            ) : (
              records.slice(0, 7).map((r) => {
                const d = new Date(r.tanggal).toLocaleDateString('id-ID');
                // Determine correct status: if original status is Hadir, check if it's actually late
                let displayStatus: string = r.status;
                let cls = '';

                if (r.status === 'Hadir' && isLate(r.jamMasuk)) {
                  displayStatus = 'Telat';
                  cls = 'telat';
                } else if (displayStatus === 'Hadir') {
                  cls = 'selesai';
                } else if (displayStatus === 'Izin') {
                  cls = 'pending';
                } else if (displayStatus === 'Telat' || displayStatus === 'telat') {
                  cls = 'telat';
                }

                return (
                  <tr key={r._id}>
                    <td>{d}</td>
                    <td>{r.jamMasuk || '-'}</td>
                    <td>
                      <span className={`status-badge ${cls}`}>{displayStatus}</span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );
};

export default Absensi;
