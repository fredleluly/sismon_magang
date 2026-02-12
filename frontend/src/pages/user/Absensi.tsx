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

  // Masuk / Pulang mode
  const [absenMode, setAbsenMode] = useState<'masuk' | 'pulang'>('masuk');
  const [todayRecord, setTodayRecord] = useState<Attendance | null>(null);

  // Camera & face detection states
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [captureTimestamp, setCaptureTimestamp] = useState<string>('');
  const [captureTimezone, setCaptureTimezone] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Geolocation states
  const [geoLocation, setGeoLocation] = useState<{
    latitude: number;
    longitude: number;
    address: string;
    accuracy: number;
  } | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  // Initialize face detection only when face tab is active (lazy loading)
  const faceDetection = useFaceDetection(activeTab === 'face');

  // QR states
  const [qrToken, setQrToken] = useState('');
  const [scannedResult, setScannedResult] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const faceDetectionIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadData = useCallback(async () => {
    const res = await AttendanceAPI.getAll();
    if (res && res.success) {
      const data = res.data || [];
      setRecords(data);

      // Check today's record
      const today = new Date().toISOString().split('T')[0];
      const todayAtt = data.find((r: Attendance) => r.tanggal?.toString().split('T')[0] === today);
      setTodayRecord(todayAtt || null);

      // Auto-set mode based on today's record
      if (todayAtt && todayAtt.jamMasuk && (!todayAtt.jamKeluar || todayAtt.jamKeluar === '' || todayAtt.jamKeluar === '-')) {
        setAbsenMode('pulang');
      } else if (todayAtt && todayAtt.jamKeluar && todayAtt.jamKeluar !== '' && todayAtt.jamKeluar !== '-') {
        setAbsenMode('pulang');
      } else {
        setAbsenMode('masuk');
      }
    }
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

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Initialize QR Scanner when tab changes
  useEffect(() => {
    if (activeTab === 'qr') {
      const timer = setTimeout(() => {
        const scanner = new Html5QrcodeScanner(
          'reader',
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
            showTorchButtonIfSupported: true,
          },
          false
        );

        scanner.render(
          (decodedText) => {
            scanner.clear();
            setScannedResult(decodedText);
            handleScan(decodedText);
          },
          () => {}
        );

        return () => {
          scanner.clear().catch((error) => console.error('Failed to clear scanner. ', error));
        };
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [activeTab]);

  // Get geolocation
  const getGeoLocation = useCallback((): Promise<{ latitude: number; longitude: number; accuracy: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation tidak didukung browser ini.'));
        return;
      }
      setGeoLoading(true);
      setGeoError(null);
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          let address = '';
          try {
            const resp = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
              { headers: { 'Accept-Language': 'id' } }
            );
            const data = await resp.json();
            address = data.display_name || '';
          } catch {
            address = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
          }
          const loc = { latitude, longitude, address, accuracy };
          setGeoLocation(loc);
          setGeoLoading(false);
          resolve({ latitude, longitude, accuracy });
        },
        (err) => {
          setGeoLoading(false);
          let msg = 'Gagal mendapatkan lokasi.';
          if (err.code === 1) msg = 'Izin lokasi ditolak. Aktifkan GPS dan izinkan lokasi.';
          else if (err.code === 2) msg = 'Posisi tidak tersedia.';
          else if (err.code === 3) msg = 'Timeout mendapatkan lokasi.';
          setGeoError(msg);
          reject(new Error(msg));
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    });
  }, []);

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
    if (!window.isSecureContext) {
      showToast('Kamera memerlukan koneksi HTTPS aman.', 'error');
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showToast('Browser ini tidak mendukung akses kamera.', 'error');
      return;
    }

    // Get geolocation in parallel
    getGeoLocation().catch(() => {});

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
        };
      }
    } catch (err: any) {
      console.error('Camera Error:', err);
      let msg = 'Gagal mengakses kamera.';
      if (err.name === 'NotAllowedError') msg = 'Izin kamera ditolak.';
      else if (err.name === 'NotFoundError') msg = 'Kamera tidak ditemukan.';
      else if (err.name === 'NotReadableError') msg = 'Kamera sedang digunakan aplikasi lain.';
      showToast(msg, 'error');
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
    faceDetection.stopDetection();
    setCameraActive(false);
  };

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

    const now = new Date();
    const dateStr = now.toLocaleString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const timeDetailStr =
      now.toLocaleString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }) + ' WIB';

    const fontSize = Math.max(14, canvas.width * 0.032);
    const lineHeight = fontSize * 1.35;
    const padding = Math.max(10, canvas.width * 0.02);

    // === LEFT SIDE: Mode label + Date + Time watermark ===
    ctx.font = `700 ${fontSize}px "Plus Jakarta Sans", sans-serif`;
    ctx.textAlign = 'left';
    ctx.lineWidth = Math.max(3, fontSize * 0.15);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.lineJoin = 'round';

    // Mode label (MASUK/PULANG)
    const modeLabel = absenMode === 'masuk' ? '📥 ABSEN MASUK' : '📤 ABSEN PULANG';
    const modeFontSize = fontSize * 0.8;
    ctx.font = `800 ${modeFontSize}px "Plus Jakarta Sans", sans-serif`;
    ctx.strokeText(modeLabel, padding, canvas.height - padding - lineHeight * 2.5);
    ctx.fillStyle = absenMode === 'masuk' ? 'rgba(74, 222, 128, 0.95)' : 'rgba(251, 191, 36, 0.95)';
    ctx.fillText(modeLabel, padding, canvas.height - padding - lineHeight * 2.5);

    // Date
    ctx.font = `700 ${fontSize}px "Plus Jakarta Sans", sans-serif`;
    ctx.strokeText(dateStr, padding, canvas.height - padding - lineHeight);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fillText(dateStr, padding, canvas.height - padding - lineHeight);

    // Time
    ctx.font = `600 ${fontSize * 0.85}px "Plus Jakarta Sans", sans-serif`;
    ctx.strokeText(timeDetailStr, padding, canvas.height - padding);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillText(timeDetailStr, padding, canvas.height - padding);

    // === RIGHT SIDE: Geolocation watermark ===
    if (geoLocation) {
      ctx.textAlign = 'right';
      const geoFontSize = fontSize * 0.65;
      const geoLineHeight = geoFontSize * 1.4;
      const rightPadding = canvas.width - padding;

      // Coordinates
      ctx.font = `600 ${geoFontSize}px "Plus Jakarta Sans", sans-serif`;
      const coordsText = `📍 ${geoLocation.latitude.toFixed(6)}, ${geoLocation.longitude.toFixed(6)}`;
      ctx.strokeText(coordsText, rightPadding, canvas.height - padding - geoLineHeight);
      ctx.fillStyle = 'rgba(147, 197, 253, 0.95)';
      ctx.fillText(coordsText, rightPadding, canvas.height - padding - geoLineHeight);

      // Address (truncated)
      let addrText = geoLocation.address;
      if (addrText.length > 50) addrText = addrText.substring(0, 50) + '...';
      ctx.font = `500 ${geoFontSize * 0.9}px "Plus Jakarta Sans", sans-serif`;
      ctx.strokeText(addrText, rightPadding, canvas.height - padding);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.fillText(addrText, rightPadding, canvas.height - padding);
    }

    const photo = canvas.toDataURL('image/jpeg', 0.8);
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

    setCapturedPhoto(photo);
    setCaptureTimestamp(now.toISOString());
    setCaptureTimezone(tz);
    stopCamera();
  };

  const handleCapture = () => {
    if (!faceDetection.faceDetected) {
      showToast('Wajah tidak terdeteksi. Posisikan wajah Anda di depan kamera.', 'error');
      return;
    }

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

    if (absenMode === 'masuk' && isCurrentTimeLate()) {
      setShowLateWarning(true);
      return;
    }

    await doSubmit();
  };

  const doSubmit = async () => {
    setSubmitting(true);
    try {
      const locationData = geoLocation
        ? {
            latitude: geoLocation.latitude,
            longitude: geoLocation.longitude,
            address: geoLocation.address,
            accuracy: geoLocation.accuracy,
          }
        : undefined;

      let res;
      if (absenMode === 'masuk') {
        res = await AttendanceAPI.photoCheckin(capturedPhoto!, captureTimestamp, captureTimezone, locationData);
      } else {
        res = await AttendanceAPI.photoCheckout(capturedPhoto!, captureTimestamp, captureTimezone, locationData);
      }

      if (res && res.success) {
        showToast(
          absenMode === 'masuk' ? 'Absensi masuk berhasil!' : 'Absensi pulang berhasil!',
          'success'
        );
        setCapturedPhoto(null);
        setCaptureTimestamp('');
        setGeoLocation(null);
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
    if (absenMode === 'masuk' && isCurrentTimeLate()) {
      setScannedResult(decodedText);
      setShowLateWarning(true);
      return;
    }
    await submitQr(decodedText);
  };

  const handleTokenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qrToken) return;
    if (absenMode === 'masuk' && isCurrentTimeLate()) {
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

  const now_d = new Date();
  const dateStr = now_d.toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const liveTime = currentTime.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const lastTimeMasuk =
    records.length > 0 && records[0].jamMasuk ? records[0].jamMasuk + ' WIB' : '--:-- WIB';
  const lastTimePulang =
    records.length > 0 &&
    records[0].jamKeluar &&
    records[0].jamKeluar !== '' &&
    records[0].jamKeluar !== '-'
      ? records[0].jamKeluar + ' WIB'
      : '--:-- WIB';

  const alreadyCheckedIn = !!todayRecord && !!todayRecord.jamMasuk;
  const alreadyCheckedOut =
    !!todayRecord &&
    !!todayRecord.jamKeluar &&
    todayRecord.jamKeluar !== '' &&
    todayRecord.jamKeluar !== '-';

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
      {/* Date bar with masuk & pulang last times */}
      <div className="absensi-date-bar">
        <div className="date-info">
          <div className="date-icon">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
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
        <div className="last-absensi-group">
          <div className="last-absensi">
            <span>Masuk</span>
            <span className="time">{lastTimeMasuk}</span>
          </div>
          <div className="last-absensi">
            <span>Pulang</span>
            <span className="time">{lastTimePulang}</span>
          </div>
        </div>
      </div>

      {/* MASUK / PULANG Toggle */}
      <div className="absen-mode-toggle">
        <button
          className={`mode-btn ${absenMode === 'masuk' ? 'active masuk' : ''}`}
          onClick={() => {
            setAbsenMode('masuk');
            setCapturedPhoto(null);
            stopCamera();
          }}
          disabled={alreadyCheckedIn}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
            <polyline points="10 17 15 12 10 7" />
            <line x1="15" y1="12" x2="3" y2="12" />
          </svg>
          Absen Masuk
          {alreadyCheckedIn && <span className="check-badge">✓</span>}
        </button>
        <button
          className={`mode-btn ${absenMode === 'pulang' ? 'active pulang' : ''}`}
          onClick={() => {
            setAbsenMode('pulang');
            setCapturedPhoto(null);
            stopCamera();
          }}
          disabled={!alreadyCheckedIn || alreadyCheckedOut}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Absen Pulang
          {alreadyCheckedOut && <span className="check-badge">✓</span>}
        </button>
      </div>

      {/* Status Cards */}
      <div className="absen-status-cards">
        <div className={`status-card ${alreadyCheckedIn ? 'done' : 'pending'}`}>
          <div className="status-card-icon masuk-icon">
            {alreadyCheckedIn ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            )}
          </div>
          <div>
            <span className="status-card-label">Masuk</span>
            <span className="status-card-time">{todayRecord?.jamMasuk || '--:--'}</span>
          </div>
          {todayRecord?.locationMasuk?.address && (
            <div
              className="status-card-location"
              title={todayRecord.locationMasuk.address}
            >
              📍 {todayRecord.locationMasuk.address.substring(0, 40)}
              {todayRecord.locationMasuk.address.length > 40 ? '...' : ''}
            </div>
          )}
        </div>
        <div className={`status-card ${alreadyCheckedOut ? 'done' : 'pending'}`}>
          <div className="status-card-icon pulang-icon">
            {alreadyCheckedOut ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            )}
          </div>
          <div>
            <span className="status-card-label">Pulang</span>
            <span className="status-card-time">
              {todayRecord?.jamKeluar &&
              todayRecord.jamKeluar !== '' &&
              todayRecord.jamKeluar !== '-'
                ? todayRecord.jamKeluar
                : '--:--'}
            </span>
          </div>
          {todayRecord?.locationPulang?.address && (
            <div
              className="status-card-location"
              title={todayRecord.locationPulang.address}
            >
              📍 {todayRecord.locationPulang.address.substring(0, 40)}
              {todayRecord.locationPulang.address.length > 40 ? '...' : ''}
            </div>
          )}
        </div>
      </div>

      {/* Face / QR Tabs */}
      <div className="absensi-tabs">
        <button
          className={`tab-btn ${activeTab === 'face' ? 'active' : ''}`}
          onClick={() => switchTab('face')}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
          Foto Wajah
        </button>
        <button
          className={`tab-btn ${activeTab === 'qr' ? 'active' : ''}`}
          onClick={() => switchTab('qr')}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
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
          <div
            className="qr-icon"
            style={{
              background: absenMode === 'masuk' ? '#dcfce7' : '#fef3c7',
            }}
          >
            {absenMode === 'masuk' ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#16a34a"
                strokeWidth="2"
              >
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#d97706"
                strokeWidth="2"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            )}
          </div>
          <h3>Absensi {absenMode === 'masuk' ? 'Masuk' : 'Pulang'} — Foto Wajah</h3>
          <p>
            Ambil foto selfie untuk mencatat{' '}
            {absenMode === 'masuk' ? 'kehadiran' : 'kepulangan'} Anda
          </p>

          {/* Live clock */}
          <div className="face-live-clock">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{ width: 16, height: 16 }}
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span>{liveTime} WIB</span>
          </div>

          {/* Geolocation Status */}
          <div className="geo-status-container">
            {geoLoading && (
              <div className="geo-status geo-loading">
                <div className="status-spinner"></div>
                <span>Mendapatkan lokasi...</span>
              </div>
            )}
            {geoError && (
              <div className="geo-status geo-error">
                <span>⚠️ {geoError}</span>
                <button
                  className="btn-retry"
                  onClick={() => getGeoLocation().catch(() => {})}
                >
                  Coba Lagi
                </button>
              </div>
            )}
            {geoLocation && !geoLoading && (
              <div className="geo-status geo-ready">
                <span>
                  📍{' '}
                  {geoLocation.address.substring(0, 60)}
                  {geoLocation.address.length > 60 ? '...' : ''}
                </span>
              </div>
            )}
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
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    style={{ width: 16, height: 16 }}
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                  <span>{faceDetection.error}</span>
                  <button className="btn-retry" onClick={faceDetection.retryInit}>
                    Coba Lagi
                  </button>
                </div>
              )}
              {faceDetection.ready && cameraActive && !faceDetection.error && (
                <div
                  className={`face-detection-status ${
                    faceDetection.faceDetected
                      ? 'face-detection-ready'
                      : 'face-detection-searching'
                  }`}
                >
                  {faceDetection.faceDetected ? (
                    <>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        style={{ width: 16, height: 16 }}
                      >
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <polyline points="22 4 12 14.01 9 11.01" />
                      </svg>
                      <span>
                        {faceDetection.validation?.message || 'Wajah terdeteksi ✓'}
                      </span>
                    </>
                  ) : (
                    <>
                      <div className="searching-icon"></div>
                      <span>
                        {faceDetection.validation?.message || 'Mencari wajah...'}
                      </span>
                    </>
                  )}
                </div>
              )}
              {faceDetection.ready &&
                cameraActive &&
                faceDetection.validation &&
                faceDetection.validation.hasFace && (
                  <div className="face-validation-checklist">
                    <span
                      className={
                        faceDetection.validation.hasEyes ? 'check-ok' : 'check-fail'
                      }
                    >
                      {faceDetection.validation.hasEyes ? '✓' : '✗'} Mata
                    </span>
                    <span
                      className={
                        faceDetection.validation.hasMouth ? 'check-ok' : 'check-fail'
                      }
                    >
                      {faceDetection.validation.hasMouth ? '✓' : '✗'} Mulut
                    </span>
                    <span
                      className={
                        faceDetection.validation.hasNose ? 'check-ok' : 'check-fail'
                      }
                    >
                      {faceDetection.validation.hasNose ? '✓' : '✗'} Hidung
                    </span>
                    <span
                      className={
                        faceDetection.validation.isProperSize ? 'check-ok' : 'check-fail'
                      }
                    >
                      {faceDetection.validation.isProperSize ? '✓' : '✗'} Jarak
                    </span>
                  </div>
                )}
            </div>
          )}

          {/* Already done message */}
          {((absenMode === 'masuk' && alreadyCheckedIn) ||
            (absenMode === 'pulang' && alreadyCheckedOut)) && (
            <div className="already-done-msg">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                style={{ width: 20, height: 20 }}
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <span>Anda sudah absen {absenMode} hari ini.</span>
            </div>
          )}

          {/* Camera or captured result */}
          {!((absenMode === 'masuk' && alreadyCheckedIn) ||
            (absenMode === 'pulang' && alreadyCheckedOut)) && (
            <>
              {absenMode === 'pulang' && !alreadyCheckedIn && (
                <div
                  className="already-done-msg"
                  style={{
                    background: '#fef3c7',
                    color: '#92400e',
                    borderColor: '#fde68a',
                  }}
                >
                  <span>
                    ⚠️ Anda belum absen masuk. Silakan absen masuk terlebih dahulu.
                  </span>
                </div>
              )}

              {!(absenMode === 'pulang' && !alreadyCheckedIn) && (
                <>
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
                        {countdown !== null && (
                          <div className="face-countdown-overlay">
                            <span className="face-countdown-number">{countdown}</span>
                          </div>
                        )}
                        {!cameraActive && (
                          <div className="face-camera-placeholder">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              style={{ width: 64, height: 64, opacity: 0.3 }}
                            >
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
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              style={{ width: 18, height: 18, marginRight: 6 }}
                            >
                              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                              <circle cx="12" cy="13" r="4" />
                            </svg>
                            {faceDetection.loading ? 'Memuat...' : 'Buka Kamera'}
                          </button>
                        ) : (
                          <div
                            style={{
                              display: 'flex',
                              gap: 8,
                              flexDirection: 'column',
                              alignItems: 'center',
                            }}
                          >
                            {!faceDetection.faceDetected &&
                              faceDetection.ready &&
                              faceDetection.validation && (
                                <p
                                  style={{
                                    fontSize: '0.875rem',
                                    color: 'var(--orange-600)',
                                    margin: 0,
                                    textAlign: 'center',
                                  }}
                                >
                                  ⚠️ {faceDetection.validation.message}
                                </p>
                              )}
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button
                                className="btn btn-primary"
                                onClick={handleCapture}
                                disabled={
                                  countdown !== null ||
                                  !faceDetection.faceDetected ||
                                  faceDetection.loading
                                }
                                title={
                                  !faceDetection.faceDetected
                                    ? 'Wajah belum terdeteksi'
                                    : 'Ambil foto'
                                }
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  style={{ width: 18, height: 18, marginRight: 6 }}
                                >
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
                        <img
                          src={capturedPhoto}
                          alt="Foto absensi"
                          style={{
                            width: '100%',
                            maxWidth: 400,
                            borderRadius: 'var(--radius-md)',
                          }}
                        />
                      </div>
                      <div className="face-result-actions">
                        <button
                          className="btn-outline"
                          onClick={retakePhoto}
                          disabled={submitting}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            style={{ width: 16, height: 16, marginRight: 4 }}
                          >
                            <polyline points="1 4 1 10 7 10" />
                            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                          </svg>
                          Foto Ulang
                        </button>
                        <button
                          className="btn btn-primary"
                          onClick={submitAbsensi}
                          disabled={submitting}
                        >
                          {submitting
                            ? 'Mengirim...'
                            : absenMode === 'masuk'
                            ? 'Kirim Absen Masuk'
                            : 'Kirim Absen Pulang'}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* QR SCAN SECTION */}
      {activeTab === 'qr' && (
        <div className="qr-section">
          <div className="qr-icon">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
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
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || !qrToken}
            >
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
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#b45309"
                strokeWidth="2"
              >
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
              </svg>
            </div>
            <h3>⏰ Anda Sedang Telat!</h3>
            <p>Waktu saat ini melampaui batas jam absensi ({lateThreshold}).</p>
            <p className="warning-message">
              Anda tetap bisa melakukan absensi, namun akan dicatat sebagai
              &ldquo;Telat&rdquo;
            </p>
            <div className="late-warning-buttons">
              <button
                className="btn-cancel"
                onClick={() => setShowLateWarning(false)}
              >
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
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
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
              <th>Masuk</th>
              <th>Pulang</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  style={{ textAlign: 'center', padding: 20, color: 'var(--gray-400)' }}
                >
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
                } else if (
                  displayStatus === 'Telat' ||
                  displayStatus === 'telat'
                ) {
                  cls = 'telat';
                }

                return (
                  <tr key={r._id}>
                    <td>{d}</td>
                    <td>{r.jamMasuk || '-'}</td>
                    <td>
                      {r.jamKeluar &&
                      r.jamKeluar !== '' &&
                      r.jamKeluar !== '-'
                        ? r.jamKeluar
                        : '-'}
                    </td>
                    <td>
                      <span className={`status-badge ${cls}`}>
                        {displayStatus}
                      </span>
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
