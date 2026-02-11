import React, { useEffect, useState, useRef, useCallback } from 'react';
import { AttendanceAPI } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { Html5QrcodeScanner } from 'html5-qrcode';
import type { Attendance } from '../../types';
import { useFaceDetection } from '../../hooks/useFaceLandmarkDetection';
import './Absensi.css';

const Absensi: React.FC = () => {
  const { showToast } = useToast();
  const [records, setRecords] = useState<Attendance[]>([]);
  const [lateThreshold, setLateThreshold] = useState<string>('08:00');
  const [showLateWarning, setShowLateWarning] = useState(false);
  const [activeTab, setActiveTab] = useState<'face' | 'qr'>('face');

  // Camera & face detection states
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [captureTimestamp, setCaptureTimestamp] = useState<string>('');
  const [captureTimezone, setCaptureTimezone] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Initialize face detection only when face tab is active (lazy loading)
  const faceDetection = useFaceDetection(activeTab === 'face');

  // QR states
  const [qrToken, setQrToken] = useState('');
  const [scannedResult, setScannedResult] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const faceDetectionIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadData = useCallback(async () => {
    const res = await AttendanceAPI.getAll();
    if (res && res.success) setRecords(res.data || []);
  }, []);

  // Load late threshold
  useEffect(() => {
    const loadThreshold = async () => {
      try {
        const res = await AttendanceAPI.getLateThreshold();
        if (res && res.success) {
          setLateThreshold(res.data.lateThreshold);
        } else {
          const saved = localStorage.getItem('lateThreshold');
          if (saved) setLateThreshold(saved);
        }
      } catch {
        const saved = localStorage.getItem('lateThreshold');
        if (saved) setLateThreshold(saved);
      }
    };
    loadThreshold();
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Cleanup camera on unmount or tab switch
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Initialize QR Scanner when tab changes
  useEffect(() => {
    if (activeTab === 'qr') {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        const scanner = new Html5QrcodeScanner(
          'reader',
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
            showTorchButtonIfSupported: true,
          },
          /* verbose= */ false
        );

        scanner.render(
          (decodedText) => {
            scanner.clear();
            setScannedResult(decodedText);
            handleScan(decodedText);
          },
          (error) => {
            // console.warn(error);
          }
        );

        // Cleanup function for scanner
        return () => {
          scanner.clear().catch((error) => console.error('Failed to clear scanner. ', error));
        };
      }, 100);

      return () => clearTimeout(timer);
    } else {
      // If switching away from QR, ensure face camera is stopped too just in case
      // (Handled by stopCamera call in tab switch handler generally)
    }
  }, [activeTab]);

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

  const isCurrentTimeLate = (): boolean => {
    try {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const [thresholdHours, thresholdMinutes] = lateThreshold.split(':').map(Number);
      const thresholdTime = thresholdHours * 60 + thresholdMinutes;
      return currentMinutes > thresholdTime;
    } catch {
      return false;
    }
  };

  // ========== CAMERA & FACE DETECTION ==========

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setCameraActive(true);
          
          // Start MediaPipe face detection once camera is ready
          if (faceDetection.ready && videoRef.current) {
            faceDetection.startDetection(videoRef.current);
          }
        };
      }
    } catch (err) {
      showToast('Gagal mengakses kamera. Pastikan izin kamera diberikan.', 'error');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (faceDetectionIntervalRef.current) {
      clearInterval(faceDetectionIntervalRef.current);
      faceDetectionIntervalRef.current = null;
    }
    // Stop MediaPipe face detection
    faceDetection.stopDetection();
    setCameraActive(false);
  };

  // No longer using face detection blocking, but we can still keep the camera active state
  
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    // Draw mirrored (selfie)
    ctx.save();
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    // Add timestamp watermark directly on photo
    const now = new Date();
    const dateStr = now.toLocaleString('id-ID', {
      weekday: 'long', 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric',
    });
    const timeDetailStr = now.toLocaleString('id-ID', {
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit',
    }) + ' WIB';
    
    // Bottom-Left Watermark - larger, more visible
    const fontSize = Math.max(16, canvas.width * 0.038);
    const lineHeight = fontSize * 1.3;
    const padding = Math.max(12, canvas.width * 0.025);

    ctx.font = `700 ${fontSize}px "Plus Jakarta Sans", sans-serif`;
    ctx.textAlign = 'left';

    // Draw text with stroke outline for readability on any background
    ctx.lineWidth = Math.max(3, fontSize * 0.15);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.lineJoin = 'round';

    // Date line
    ctx.strokeText(dateStr, padding, canvas.height - padding - lineHeight);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fillText(dateStr, padding, canvas.height - padding - lineHeight);

    // Time line
    ctx.font = `600 ${fontSize * 0.85}px "Plus Jakarta Sans", sans-serif`;
    ctx.strokeText(timeDetailStr, padding, canvas.height - padding);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillText(timeDetailStr, padding, canvas.height - padding);

    const photo = canvas.toDataURL('image/jpeg', 0.8);
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

    setCapturedPhoto(photo);
    setCaptureTimestamp(now.toISOString());
    setCaptureTimezone(tz);
    stopCamera();
  };

  const handleCapture = () => {
    // Check if face is detected before allowing capture
    if (!faceDetection.faceDetected) {
      showToast('Wajah tidak terdeteksi. Posisikan wajah Anda di depan kamera.', 'error');
      return;
    }

    // Direct capture with countdown
    setCountdown(3);
    let c = 3;
    const timer = setInterval(() => {
      c--;
      if (c <= 0) {
        clearInterval(timer);
        setCountdown(null);
        capturePhoto();
      } else {
        setCountdown(c);
      }
    }, 1000);
  };

  const retakePhoto = () => {
    setCapturedPhoto(null);
    setCaptureTimestamp('');
    setCaptureTimezone('');
    startCamera();
  };

  const submitAbsensi = async () => {
    if (!capturedPhoto) {
      showToast('Ambil foto terlebih dahulu.', 'error');
      return;
    }

    if (isCurrentTimeLate()) {
      setShowLateWarning(true);
      return;
    }

    await doSubmit();
  };

  const doSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await AttendanceAPI.photoCheckin(capturedPhoto!, captureTimestamp, captureTimezone);
      if (res && res.success) {
        showToast('Absensi berhasil!', 'success');
        setCapturedPhoto(null);
        setCaptureTimestamp('');
        loadData();
      } else {
        showToast(res?.message || 'Gagal absensi.', 'error');
      }
    } catch {
      showToast('Gagal mengirim absensi.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ========== QR & TOKEN ==========
  const handleScan = async (decodedText: string) => {
    if (submitting) return;

    if (isCurrentTimeLate()) {
      setScannedResult(decodedText);
      setShowLateWarning(true);
      return;
    }

    await submitQr(decodedText);
  };

  const handleTokenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qrToken) return;

    if (isCurrentTimeLate()) {
      setScannedResult(qrToken);
      setShowLateWarning(true);
      return;
    }

    await submitQr(qrToken);
  };

  const submitQr = async (token: string) => {
    setSubmitting(true);
    try {
      const res = await AttendanceAPI.scan(token);
      if (res && res.success) {
        showToast('Absensi berhasil!', 'success');
        setQrToken('');
        setScannedResult(null);
        loadData();
      } else {
        showToast(res?.message || 'Gagal absensi.', 'error');
      }
    } catch {
      showToast('Gagal scan QR.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleProceedAnyway = async () => {
    setShowLateWarning(false);
    if (activeTab === 'face') {
      await doSubmit();
    } else {
      if (scannedResult) {
        await submitQr(scannedResult);
      }
    }
  };

  const now = new Date();
  const dateStr = now.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const liveTime = currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const lastTime = records.length > 0 && records[0].jamMasuk ? records[0].jamMasuk + ' WIB' : '--:-- WIB';

  // Switch tab handler
  const switchTab = (tab: 'face' | 'qr') => {
    setActiveTab(tab);
    if (tab === 'qr') {
      stopCamera();
      faceDetection.stopDetection();
    } else {
      setCapturedPhoto(null);
    }
  };

  // Start face detection when ready and camera is active
  useEffect(() => {
    if (faceDetection.ready && cameraActive && videoRef.current) {
      faceDetection.startDetection(videoRef.current);
    }
  }, [faceDetection.ready, cameraActive]);

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

      <div className="absensi-tabs">
        <button className={`tab-btn ${activeTab === 'face' ? 'active' : ''}`} onClick={() => switchTab('face')}>
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
          Foto Wajah
        </button>
        <button className={`tab-btn ${activeTab === 'qr' ? 'active' : ''}`} onClick={() => switchTab('qr')}>
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7"></rect>
            <rect x="14" y="3" width="7" height="7"></rect>
            <rect x="14" y="14" width="7" height="7"></rect>
            <rect x="3" y="14" width="7" height="7"></rect>
          </svg>
          Scan QR / Token
        </button>
      </div>

      {/* FACE CAPTURE SECTION */}
      {activeTab === 'face' && (
        <div className="qr-section face-capture-section">
          <div className="qr-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <h3>Absensi Foto Wajah</h3>
          <p>Ambil foto selfie untuk mencatat kehadiran Anda</p>

          {/* Live clock */}
          <div className="face-live-clock">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}>
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span>{liveTime} WIB</span>
          </div>

          {/* Face Detection Status */}
          {activeTab === 'face' && (
            <div className="face-detection-status-container">
              {faceDetection.loading && (
                <div className="face-detection-status face-detection-loading">
                  <div className="status-spinner"></div>
                  <span>Menyiapkan deteksi wajah...</span>
                </div>
              )}
              {faceDetection.error && (
                <div className="face-detection-status face-detection-error">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}>
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                  <span>{faceDetection.error}</span>
                  <button className="btn-retry" onClick={faceDetection.retryInit}>Coba Lagi</button>
                </div>
              )}
              {faceDetection.ready && cameraActive && !faceDetection.error && (
                <div className={`face-detection-status ${faceDetection.faceDetected ? 'face-detection-ready' : 'face-detection-searching'}`}>
                  {faceDetection.faceDetected ? (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}>
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <polyline points="22 4 12 14.01 9 11.01" />
                      </svg>
                      <span>{faceDetection.validation?.message || 'Wajah terdeteksi ✓'}</span>
                    </>
                  ) : (
                    <>
                      <div className="searching-icon"></div>
                      <span>{faceDetection.validation?.message || 'Mencari wajah...'}</span>
                    </>
                  )}
                </div>
              )}
              {/* Detail validation checklist */}
              {faceDetection.ready && cameraActive && faceDetection.validation && faceDetection.validation.hasFace && (
                <div className="face-validation-checklist">
                  <span className={faceDetection.validation.hasEyes ? 'check-ok' : 'check-fail'}>
                    {faceDetection.validation.hasEyes ? '✓' : '✗'} Mata
                  </span>
                  <span className={faceDetection.validation.hasMouth ? 'check-ok' : 'check-fail'}>
                    {faceDetection.validation.hasMouth ? '✓' : '✗'} Mulut
                  </span>
                  <span className={faceDetection.validation.hasNose ? 'check-ok' : 'check-fail'}>
                    {faceDetection.validation.hasNose ? '✓' : '✗'} Hidung
                  </span>
                  <span className={faceDetection.validation.isProperSize ? 'check-ok' : 'check-fail'}>
                    {faceDetection.validation.isProperSize ? '✓' : '✗'} Jarak
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Camera view or captured result */}
          {!capturedPhoto ? (
            <div className="face-camera-container">
              <div className="face-camera-wrapper">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    width: '100%',
                    maxWidth: 400,
                    borderRadius: 'var(--radius-md)',
                    transform: 'scaleX(-1)',
                    display: cameraActive ? 'block' : 'none',
                  }}
                />


                {/* Countdown overlay */}
                {countdown !== null && (
                  <div className="face-countdown-overlay">
                    <span className="face-countdown-number">{countdown}</span>
                  </div>
                )}
                {!cameraActive && (
                  <div className="face-camera-placeholder">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 64, height: 64, opacity: 0.3 }}>
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                    <p>Klik tombol di bawah untuk membuka kamera</p>
                  </div>
                )}
              </div>
              <canvas ref={canvasRef} style={{ display: 'none' }} />

              <div className="face-camera-actions">
                {!cameraActive ? (
                  <button 
                    className="btn btn-primary" 
                    onClick={startCamera}
                    disabled={faceDetection.loading || !!faceDetection.error}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18, marginRight: 6 }}>
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                    {faceDetection.loading ? 'Memuat...' : 'Buka Kamera'}
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: 8, flexDirection: 'column', alignItems: 'center' }}>
                    {!faceDetection.faceDetected && faceDetection.ready && faceDetection.validation && (
                      <p style={{ fontSize: '0.875rem', color: 'var(--orange-600)', margin: 0, textAlign: 'center' }}>
                        ⚠️ {faceDetection.validation.message}
                      </p>
                    )}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button 
                        className="btn btn-primary" 
                        onClick={handleCapture} 
                        disabled={countdown !== null || !faceDetection.faceDetected || faceDetection.loading}
                        title={!faceDetection.faceDetected ? 'Wajah belum terdeteksi' : 'Ambil foto'}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18, marginRight: 6 }}>
                          <circle cx="12" cy="12" r="10" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                        {countdown !== null ? `${countdown}...` : 'Ambil Foto'}
                      </button>
                      <button className="btn-outline" onClick={stopCamera}>
                        Batal
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="face-result-container">
              <div className="face-result-photo">
                <img src={capturedPhoto} alt="Foto absensi" style={{ width: '100%', maxWidth: 400, borderRadius: 'var(--radius-md)' }} />
              </div>
              <div className="face-result-actions">
                <button className="btn-outline" onClick={retakePhoto} disabled={submitting}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16, marginRight: 4 }}>
                    <polyline points="1 4 1 10 7 10" />
                    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                  </svg>
                  Foto Ulang
                </button>
                <button className="btn btn-primary" onClick={submitAbsensi} disabled={submitting}>
                  {submitting ? 'Mengirim...' : 'Kirim Absensi'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* QR SCAN SECTION */}
      {activeTab === 'qr' && (
        <div className="qr-section">
          <div className="qr-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
          </div>
          <h3>Scan QR Code</h3>
          <p>Arahkan kamera ke QR Code absensi atau masukkan token manual</p>

          <div id="reader"></div>

          <form onSubmit={handleTokenSubmit} className="token-input-container">
            <input
              type="text"
              className="token-input"
              placeholder="Atau masukkan token manual"
              value={qrToken}
              onChange={(e) => setQrToken(e.target.value)}
              disabled={submitting}
            />
            <button type="submit" className="btn btn-primary" disabled={submitting || !qrToken}>
              {submitting ? '...' : 'Kirim'}
            </button>
          </form>
        </div>
      )}

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

      {/* History */}
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
