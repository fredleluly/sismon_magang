import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Lightweight Face Detection Hook using face-api.js (CDN)
 *
 * Much lighter than MediaPipe (~400KB vs ~3MB).
 * Detects face landmarks (68 points) to validate:
 *  1. Face is present
 *  2. Eyes are visible (landmarks 36-47)
 *  3. Nose is visible (landmarks 27-35)
 *  4. Mouth is visible (landmarks 48-67)
 *  5. Face is properly framed (not too zoomed / too far)
 */

export interface FaceValidation {
  hasFace: boolean;
  hasEyes: boolean;
  hasMouth: boolean;
  hasNose: boolean;
  isProperSize: boolean;
  faceRatio: number;
  message: string;
}

interface UseFaceDetectionReturn {
  supported: boolean;
  loading: boolean;
  ready: boolean;
  error: string | null;
  faceDetected: boolean;
  validation: FaceValidation | null;
  startDetection: (videoElement: HTMLVideoElement) => void;
  stopDetection: () => void;
  retryInit: () => void;
}

const MIN_FACE_RATIO = 0.15;
const MAX_FACE_RATIO = 0.82;

// CDN URLs
const FACE_API_CDN = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js';
const MODEL_BASE_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights/';

// Global loading state
let faceApiLoaded = false;
let faceApiLoading: Promise<void> | null = null;
let modelsLoaded = false;

/** Load face-api.js script from CDN */
function loadFaceApiScript(): Promise<void> {
  if (faceApiLoaded && (window as any).faceapi) return Promise.resolve();
  if (faceApiLoading) return faceApiLoading;

  faceApiLoading = new Promise<void>((resolve, reject) => {
    // Already loaded?
    if ((window as any).faceapi) {
      faceApiLoaded = true;
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = FACE_API_CDN;
    script.async = true;
    script.crossOrigin = 'anonymous';

    script.onload = () => {
      if ((window as any).faceapi) {
        faceApiLoaded = true;
        console.log('[FaceDetect] ✓ face-api.js loaded from CDN');
        resolve();
      } else {
        reject(new Error('face-api.js dimuat tetapi object faceapi tidak ditemukan'));
      }
    };

    script.onerror = () => {
      faceApiLoading = null;
      reject(new Error('Gagal memuat face-api.js dari CDN. Periksa koneksi internet.'));
    };

    document.head.appendChild(script);
  });

  return faceApiLoading;
}

/** Load the tiny face detector + landmark model */
async function loadModels(): Promise<void> {
  if (modelsLoaded) return;

  const faceapi = (window as any).faceapi;
  if (!faceapi) throw new Error('faceapi belum dimuat');

  console.log('[FaceDetect] Loading models...');

  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_BASE_URL),
    faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_BASE_URL),
  ]);

  modelsLoaded = true;
  console.log('[FaceDetect] ✓ Models loaded (tinyFaceDetector + faceLandmark68Tiny)');
}

function createValidation(
  hasFace: boolean,
  hasEyes: boolean,
  hasMouth: boolean,
  hasNose: boolean,
  faceRatio: number
): FaceValidation {
  const isProperSize = faceRatio >= MIN_FACE_RATIO && faceRatio <= MAX_FACE_RATIO;

  let message = '';
  if (!hasFace) {
    message = 'Wajah tidak terdeteksi';
  } else if (!hasEyes) {
    message = 'Mata tidak terdeteksi — pastikan wajah terlihat jelas';
  } else if (!hasMouth) {
    message = 'Mulut tidak terdeteksi — pastikan wajah terlihat penuh';
  } else if (faceRatio > MAX_FACE_RATIO) {
    message = 'Wajah terlalu dekat — mundur sedikit dari kamera';
  } else if (faceRatio < MIN_FACE_RATIO) {
    message = 'Wajah terlalu jauh — dekatkan ke kamera';
  } else {
    message = 'Wajah terdeteksi ✓';
  }

  return { hasFace, hasEyes, hasMouth, hasNose, isProperSize, faceRatio, message };
}

/**
 * Check if a group of landmarks is "visible" — they must have reasonable
 * spread (not all collapsed to one point which indicates partial face).
 */
function landmarkGroupVisible(points: { x: number; y: number }[]): boolean {
  if (!points || points.length < 2) return false;

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  const spread = Math.max(maxX - minX, maxY - minY);
  return spread > 3; // at least 3px spread means the feature is actually visible
}

export const useFaceDetection = (enabled: boolean = true): UseFaceDetectionReturn => {
  const [supported] = useState(true); // face-api.js works in all browsers
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [validation, setValidation] = useState<FaceValidation | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const initialize = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('[FaceDetect] Initializing...');

      // Step 1: Load script
      await loadFaceApiScript();

      // Step 2: Load models
      await loadModels();

      if (!mountedRef.current) return;

      setReady(true);
      setLoading(false);
      console.log('[FaceDetect] ✓ Ready!');
    } catch (err: any) {
      if (!mountedRef.current) return;
      console.error('[FaceDetect] ✗ Init failed:', err);
      setError(err?.message || 'Gagal menginisialisasi deteksi wajah');
      setLoading(false);
      setReady(false);
    }
  }, []);

  const startDetection = useCallback((videoElement: HTMLVideoElement) => {
    const faceapi = (window as any).faceapi;
    if (!faceapi || !modelsLoaded || !videoElement) {
      console.warn('[FaceDetect] Cannot start: not ready');
      return;
    }

    console.log('[FaceDetect] Starting detection...');

    if (intervalRef.current) clearInterval(intervalRef.current);

    const options = new faceapi.TinyFaceDetectorOptions({
      inputSize: 224,      // smaller = faster (options: 128, 160, 224, 320, 416, 512, 608)
      scoreThreshold: 0.4,
    });

    // Detect at ~5 FPS
    intervalRef.current = setInterval(async () => {
      if (!videoElement || videoElement.readyState < 2) return;

      try {
        const result = await faceapi
          .detectSingleFace(videoElement, options)
          .withFaceLandmarks(true); // true = use tiny model

        const frameWidth = videoElement.videoWidth || 640;

        if (!result) {
          setFaceDetected(false);
          setValidation(createValidation(false, false, false, false, 0));
          return;
        }

        const box = result.detection.box;
        const faceRatio = box.width / frameWidth;

        // Get the 68 landmark points
        const landmarks = result.landmarks;
        const pts = landmarks.positions;

        // Face landmarks indices (68-point model):
        // 0-16: jaw line
        // 17-21: left eyebrow
        // 22-26: right eyebrow  
        // 27-35: nose
        // 36-41: left eye
        // 42-47: right eye
        // 48-59: outer lip
        // 60-67: inner lip

        const leftEye = pts.slice(36, 42);
        const rightEye = pts.slice(42, 48);
        const nose = pts.slice(27, 36);
        const mouth = pts.slice(48, 68);

        const hasEyes = landmarkGroupVisible(leftEye) && landmarkGroupVisible(rightEye);
        const hasNose = landmarkGroupVisible(nose);
        const hasMouth = landmarkGroupVisible(mouth);

        const v = createValidation(true, hasEyes, hasMouth, hasNose, faceRatio);
        const allGood = v.hasFace && v.hasEyes && v.hasMouth && v.isProperSize;

        setFaceDetected(allGood);
        setValidation(v);
      } catch (err) {
        // Non-fatal
        console.warn('[FaceDetect] Frame error:', err);
      }
    }, 200);
  }, []);

  const stopDetection = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setFaceDetected(false);
    setValidation(null);
  }, []);

  const retryInit = useCallback(() => {
    setError(null);
    setReady(false);
    setLoading(false);
    faceApiLoaded = false;
    faceApiLoading = null;
    modelsLoaded = false;
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (enabled && !ready && !loading && !error) {
      initialize();
    }
  }, [enabled, ready, loading, error, initialize]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopDetection();
    };
  }, [stopDetection]);

  return {
    supported,
    loading,
    ready,
    error,
    faceDetected,
    validation,
    startDetection,
    stopDetection,
    retryInit,
  };
};
