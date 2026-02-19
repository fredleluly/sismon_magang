import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User } from '../types';
import { AuthAPI } from '../services/api';

interface AuthContextType {
  user: User | null;
  isLoggedIn: boolean;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<{ success: boolean; message?: string; user?: User }>;
  register: (name: string, email: string, password: string, instansi: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  refreshUser: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(() => {
    setUser(AuthAPI.getCurrentUser());
  }, []);

  useEffect(() => {
    setUser(AuthAPI.getCurrentUser());
    setLoading(false);
  }, []);

  const login = async (identifier: string, password: string) => {
    const res = await AuthAPI.login(identifier, password);
    if (res && res.success) {
      setUser(res.data.user);
      return { success: true, message: res.message, user: res.data.user };
    }
    return { success: false, message: res?.message || 'Gagal terhubung ke server.' };
  };

  const register = async (name: string, email: string, password: string, instansi: string) => {
    const res = await AuthAPI.register(name, email, password, instansi);
    if (res && res.success) {
      setUser(res.data.user);
      return { success: true, message: res.message };
    }
    return { success: false, message: res?.message || 'Gagal terhubung ke server.' };
  };

  const logout = () => {
    setUser(null);
    AuthAPI.logout();
  };

  return (
    <AuthContext.Provider value={{ user, isLoggedIn: !!user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
