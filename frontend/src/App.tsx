import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import Toast from "./components/ui/Toast";

// Auth pages
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";

// User pages
import UserLayout from "./components/layout/UserLayout";

// Admin pages
import AdminLayout from "./components/layout/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";

import DataPeserta from "./pages/admin/DataPeserta";
import LogAktivitas from "./pages/admin/LogAktivitas";
import KelolaKeluhan from "./pages/admin/KelolaKeluhan";
import AttendanceCalendar from "./pages/admin/AttendanceCalendar";
import TargetSection from "./pages/admin/TargetSection";
import PenilaianPerforma from "./pages/admin/PenilaianPerforma";
import ManajemenPenilaian from "./pages/admin/ManajemenPenilaian";
import Ranking from "./pages/admin/Ranking";
import Rekapitulasi from "./pages/admin/Rekapitulasi";

interface ProtectedRouteProps {
  children: React.ReactNode;
  role?: "admin" | "user" | "superadmin" | ("admin" | "superadmin")[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, role }) => {
  const { isLoggedIn, user, loading } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          color: "#64748b",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: 40,
              height: 40,
              border: "3px solid #e2e8f0",
              borderTop: "3px solid #0a6599",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              margin: "0 auto 12px",
            }}
          />
          <p>Memuat...</p>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  if (role) {
    const allowedRoles = Array.isArray(role) ? role : [role];
    if (!allowedRoles.includes(user?.role as any)) {
      return (
        <Navigate
          to={user?.role === "user" ? "/dashboard" : "/admin"}
          replace
        />
      );
    }
  }

  return <>{children}</>;
};

const AppRoutes: React.FC = () => {
  const { isLoggedIn, user } = useAuth();

  return (
    <Routes>
      {/* Auth routes */}
      <Route
        path="/login"
        element={
          isLoggedIn ? (
            <Navigate
              to={user?.role === "admin" ? "/admin" : "/dashboard"}
              replace
            />
          ) : (
            <Login />
          )
        }
      />
      <Route
        path="/register"
        element={
          isLoggedIn ? (
            <Navigate
              to={user?.role === "admin" ? "/admin" : "/dashboard"}
              replace
            />
          ) : (
            <Register />
          )
        }
      />

      {/* User routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute role="user">
            <UserLayout />
          </ProtectedRoute>
        }
      />

      {/* Admin routes */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute role={["admin", "superadmin"]}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboard />} />

        <Route path="peserta" element={<DataPeserta />} />
        <Route path="log" element={<LogAktivitas />} />
        <Route path="keluhan" element={<KelolaKeluhan />} />
        <Route path="absensi" element={<AttendanceCalendar />} />
        <Route path="target-section" element={<TargetSection />} />
        <Route path="penilaian" element={<PenilaianPerforma />} />
        <Route path="manajemen-penilaian" element={<ManajemenPenilaian />} />
        <Route path="ranking" element={<Ranking />} />
        <Route path="rekapitulasi" element={<Rekapitulasi />} />
      </Route>

      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
          <Toast />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
