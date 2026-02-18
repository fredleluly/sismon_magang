// ===== USER =====
export interface User {
  _id: string;
  name: string;
  email: string;
  role: "admin" | "user" | "superadmin";
  instansi?: string;
  jabatan?: string;
  status?: string;
  totalBerkas?: number;
  totalBuku?: number;
  totalBundle?: number;
  createdAt?: string;
}

// ===== WORK LOG =====
export interface WorkLog {
  _id: string;
  userId?: User | string;
  tanggal: string;
  jenis: string;
  keterangan?: string;
  berkas: number;
  buku: number;
  bundle: number;
  status: "Draft" | "Selesai";
  createdAt: string;
}

// ===== GEOLOCATION =====
export interface GeoLocation {
  latitude: number | null;
  longitude: number | null;
  address: string;
  accuracy: number | null;
}

// ===== ATTENDANCE =====
export interface Attendance {
  _id: string;
  userId?: User;
  tanggal: string;
  jamMasuk?: string;
  jamKeluar?: string;
  status:
    | "Hadir"
    | "Telat"
    | "Izin"
    | "Alpha"
    | "Sakit"
    | "Tidak Hadir"
    | "Hari Libur"
    | "Belum Absen";
  fotoAbsensi?: string;
  fotoUrl?: string;
  fotoTimestamp?: string;
  fotoPulang?: string;
  fotoPulangUrl?: string;
  fotoPulangTimestamp?: string;
  locationMasuk?: GeoLocation;
  locationPulang?: GeoLocation;
  keterangan?: string;
  createdAt?: string;
}

// ===== COMPLAINT =====
export interface Complaint {
  _id: string;
  userId?: User;
  judul: string;
  kategori: string;
  prioritas: "Low" | "Medium" | "High";
  deskripsi: string;
  status: "Menunggu" | "Diproses" | "Selesai";
  createdAt: string;
}

// ===== QR CODE =====
export interface QRCode {
  _id: string;
  token: string;
  tanggal: string;
  scannedBy?: string[];
  scannedCount?: number;
  createdAt?: string;
}

// ===== DASHBOARD =====
export interface WeeklyProgress {
  _id: string;
  berkas: number;
  buku: number;
  bundle: number;
}

export interface WorkDistribution {
  _id: string;
  count: number;
}

export interface TopPerformer {
  name: string;
  totalItems: number;
  instansi?: string;
}

export interface UserDashboard {
  totalBerkas: number;
  totalBuku: number;
  totalBundle: number;
  recentActivity: WorkLog[];
  weeklyProgress: WeeklyProgress[];
  workDistribution: WorkDistribution[];
}

export interface AdminDashboard {
  totalPekerjaanSelesai: number;
  totalPeserta: number;
  totalBerkas: number;
  totalBuku: number;
  totalBundle: number;

  // New specific stats
  totalSortir: number;
  totalSteples: number;
  totalScanning: number;
  totalRegister: number;
  totalStikering: number;
  totalRekardus: number;
  avgProductivity: number;
  attendanceRate: number;
  todayAttendance: number;
  weeklyProgress: WeeklyProgress[];
  workDistribution: WorkDistribution[];
  topPerformers: TopPerformer[];
  recentActivity: WorkLog[];
}

// ===== API RESPONSE =====
export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data: T;
}

// ===== STATS =====
export interface WorkStats {
  berkas: number;
  buku: number;
  bundle: number;
}

// ===== TOAST =====
export type ToastType = "success" | "error" | "info";
export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

// ===== TARGET SECTION =====
export interface TargetSection {
  _id: string;
  jenis: string;
  targetPerDay: number;
}

// ===== PERFORMANCE EVALUATION =====
export interface PerformanceEvaluation {
  _id: string;
  userId: User | string;
  bulan: number;
  tahun: number;
  absen: number;
  kuantitas: number;
  kualitas: number;
  laporan: boolean;
  hasil: number;
  status: "Draft" | "Final";
  createdAt?: string;
  updatedAt?: string;
}

export interface PerformanceCalculation {
  userId: string;
  userName: string;
  bulan: number;
  tahun: number;
  absen: number;
  kuantitas: number; // Default 0, manual input
  detail: {
    totalWorkingDays: number;
    attendedDays: number;
    totalPoints: number;
    avgPoints: number;
  };
}
