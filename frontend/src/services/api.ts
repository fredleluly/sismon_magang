import type { ApiResponse, User, WorkLog, Attendance, Complaint, QRCode, UserDashboard, AdminDashboard, WorkStats } from '../types';

const API_BASE = '/api';

// ===== TOKEN MANAGEMENT =====
export function getToken(): string | null {
  return localStorage.getItem('pln_token');
}

export function setToken(token: string): void {
  localStorage.setItem('pln_token', token);
}

export function removeToken(): void {
  localStorage.removeItem('pln_token');
  localStorage.removeItem('pln_current_user');
}

// ===== HTTP HELPER =====
async function apiRequest<T = unknown>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T> | null> {
  const token = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: { ...headers, ...(options.headers as Record<string, string>) },
    });

    const data = await res.json();

    if (res.status === 401) {
      removeToken();
      window.location.href = '/login';
      return null;
    }

    return data;
  } catch (err) {
    console.error('API Error:', err);
    return { success: false, message: 'Gagal terhubung ke server. Pastikan backend berjalan.', data: {} as T };
  }
}

const API = {
  get: <T = unknown>(endpoint: string) => apiRequest<T>(endpoint),
  post: <T = unknown>(endpoint: string, body?: unknown) => apiRequest<T>(endpoint, { method: 'POST', body: JSON.stringify(body) }),
  put: <T = unknown>(endpoint: string, body?: unknown) => apiRequest<T>(endpoint, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T = unknown>(endpoint: string) => apiRequest<T>(endpoint, { method: 'DELETE' }),
};

// ===== AUTH API =====
export const AuthAPI = {
  async login(email: string, password: string) {
    const res = await API.post<{ token: string; user: User }>('/auth/login', { email, password });
    if (res && res.success) {
      setToken(res.data.token);
      localStorage.setItem('pln_current_user', JSON.stringify(res.data.user));
    }
    return res;
  },

  async register(name: string, email: string, password: string, instansi: string) {
    const res = await API.post<{ token: string; user: User }>('/auth/register', { name, email, password, instansi });
    if (res && res.success) {
      setToken(res.data.token);
      localStorage.setItem('pln_current_user', JSON.stringify(res.data.user));
    }
    return res;
  },

  async getProfile() {
    return API.get<User>('/auth/me');
  },

  async updateProfile(data: Partial<User & { password?: string }>) {
    const res = await API.put<User>('/auth/profile', data);
    if (res && res.success) {
      localStorage.setItem('pln_current_user', JSON.stringify(res.data));
    }
    return res;
  },

  logout() {
    removeToken();
    window.location.href = '/login';
  },

  isLoggedIn(): boolean {
    return !!getToken();
  },

  getCurrentUser(): User | null {
    try {
      const raw = localStorage.getItem('pln_current_user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
};

// ===== USERS API (Admin) =====
export const UsersAPI = {
  getAll: () => API.get<User[]>('/users'),
  getById: (id: string) => API.get<User>(`/users/${id}`),
  create: (data: Partial<User & { password: string }>) => API.post<User>('/users', data),
  update: (id: string, data: Partial<User>) => API.put<User>(`/users/${id}`, data),
  delete: (id: string) => API.delete(`/users/${id}`),
};

// ===== WORK LOGS API =====
export const WorkLogAPI = {
  getAll: (params = '') => API.get<WorkLog[]>(`/work-logs${params ? '?' + params : ''}`),
  create: (data: Partial<WorkLog>) => API.post<WorkLog>('/work-logs', data),
  update: (id: string, data: Partial<WorkLog>) => API.put<WorkLog>(`/work-logs/${id}`, data),
  submit: (id: string) => API.put<WorkLog>(`/work-logs/${id}/submit`),
  delete: (id: string) => API.delete(`/work-logs/${id}`),
  getMyStats: () => API.get<WorkStats>('/work-logs/stats/me'),
};

// ===== ATTENDANCE API =====
export const AttendanceAPI = {
  getAll: (params = '') => API.get<Attendance[]>(`/attendance${params ? '?' + params : ''}`),
  scan: (token: string) => API.post<Attendance>('/attendance/scan', { token }),
  checkout: (id: string) => API.put<Attendance>(`/attendance/${id}/checkout`),
  getToday: () => API.get<Attendance[]>('/attendance/today'),
  getLateThreshold: () => API.get<{ lateThreshold: string }>('/attendance/settings/late-threshold'),
  setLateThreshold: (threshold: string) => API.post<{ lateThreshold: string }>('/attendance/settings/late-threshold', { threshold }),
  updateStatus: (id: string, status: string, jamMasuk?: string) => API.put<Attendance>(`/attendance/${id}/status`, { status, ...(jamMasuk && { jamMasuk }) }),
};

// ===== COMPLAINTS API =====
export const ComplaintAPI = {
  getAll: (params = '') => API.get<Complaint[]>(`/complaints${params ? '?' + params : ''}`),
  create: (data: Partial<Complaint>) => API.post<Complaint>('/complaints', data),
  updateStatus: (id: string, status: string) => API.put<Complaint>(`/complaints/${id}/status`, { status }),
  getStats: () => API.get('/complaints/stats'),
};

// ===== QR CODE API =====
export const QRCodeAPI = {
  generate: () => API.post<QRCode>('/qrcode/generate'),
  getToday: () => API.get<QRCode>('/qrcode/today'),
  getHistory: () => API.get<QRCode[]>('/qrcode/history'),
};

// ===== DASHBOARD API =====
export const DashboardAPI = {
  getAdmin: () => API.get<AdminDashboard>('/dashboard/admin'),
  getUser: () => API.get<UserDashboard>('/dashboard/user'),
};
