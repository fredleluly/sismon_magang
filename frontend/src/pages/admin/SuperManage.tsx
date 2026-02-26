import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { PerformanceAPI, UsersAPI } from '../../services/api';
import type { PerformanceEvaluation, User } from '../../types';
import './SuperManage.css';
import SuperManagePhotoManager from './SuperManagePhotoManager';

const SuperManage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [evaluations, setEvaluations] = useState<PerformanceEvaluation[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Modal confirm
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    evaluationId: string;
    userName: string;
  }>({ show: false, evaluationId: '', userName: '' });

  const [admins, setAdmins] = useState<User[]>([]);
  const [adminsLoading, setAdminsLoading] = useState(false);

  useEffect(() => {
    const loadEvaluations = async () => {
      setLoading(true);
      try {
        const now = new Date();
        const res = await PerformanceAPI.getAll(now.getMonth() + 1, now.getFullYear());
        if (res && res.success) {
          const finalizedOnly = (res.data || []).filter((e: PerformanceEvaluation) => e.status === 'Final');
          setEvaluations(finalizedOnly);
        }
      } catch (error) {
        console.error('Failed to load evaluations', error);
      } finally {
        setLoading(false);
      }
    };
    
    const loadAdmins = async () => {
      setAdminsLoading(true);
      try {
        const res = await UsersAPI.getAdmins();
        if (res && res.success) {
          setAdmins(res.data || []);
        }
      } catch (error) {
        console.error('Failed to load admins', error);
      } finally {
        setAdminsLoading(false);
      }
    };

    if (user?.role === 'superadmin') {
      loadEvaluations();
      loadAdmins();
    }
  }, [user]);

  const handleDeleteClick = (evalId: string, userName: string) => {
    setConfirmModal({
      show: true,
      evaluationId: evalId,
      userName,
    });
  };

  const handleConfirmDelete = async () => {
    const evalId = confirmModal.evaluationId;
    setDeleting(evalId);
    try {
      const res = await PerformanceAPI.resetToDraft(evalId);
      if (res && res.success) {
        showToast('Penilaian berhasil direset ke Draft', 'success');
        setEvaluations(prev => prev.filter(e => e._id !== evalId));
        setConfirmModal({ show: false, evaluationId: '', userName: '' });
      } else {
        showToast(res?.message || 'Gagal mereset penilaian', 'error');
      }
    } catch (error) {
      showToast('Gagal mereset penilaian', 'error');
    } finally {
      setDeleting(null);
    }
  };

  if (user?.role !== 'superadmin') {
    return (
      <div className="super-manage-denied">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
        </svg>
        <h3>Akses Ditolak</h3>
        <p>Halaman ini hanya dapat diakses oleh Superadmin.</p>
      </div>
    );
  }

  const features = [
    {
      id: 'manajemen-penilaian',
      title: 'Manajemen Penilaian',
      description: 'Kelola penilaian performa peserta magang yang sudah difinalisasi. Lihat, tinjau, dan hapus penilaian final.',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14M5 12h14" />
          <circle cx="12" cy="12" r="10" />
        </svg>
      ),
      color: '#667eea',
      bgGradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      lightBg: 'linear-gradient(135deg, #ede9fe 0%, #e0e7ff 100%)',
      path: '/admin/manajemen-penilaian',
      stats: null,
    },
    {
      id: 'data-admin',
      title: 'Kelola Data Admin',
      description: 'Tambah, edit, dan hapus akun admin sistem. Hanya superadmin yang dapat mengelola data admin.',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          <circle cx="12" cy="12" r="10" strokeDasharray="4 4" />
        </svg>
      ),
      color: '#059669',
      bgGradient: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
      lightBg: 'linear-gradient(135deg, #d1fae5 0%, #bbf7d0 100%)',
      path: '/admin/super-manage/data-admin',
      stats: null,
    },
  ];

  return (
    <div className="super-manage-container">
      <div className="super-manage-header">
        <div className="super-manage-header-info">
          <div className="super-manage-header-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div>
            <h2 className="super-manage-title">Super Manage</h2>
            <p className="super-manage-subtitle">Fitur khusus yang hanya dapat diakses oleh Superadmin</p>
          </div>
        </div>
        <span className="super-manage-role-badge">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          Superadmin
        </span>
      </div>

      <div className="super-manage-row super-manage-row-1">
        {/* Card 1: Manajemen Penilaian (Table) */}
        {/* Card 1: Manajemen Penilaian (Table) */}
        <div className="super-manage-card smc-table-card">
          <div className="card-header" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '16px', marginBottom: '16px', background: 'transparent' }}>
            <h2 style={{ fontSize: '18px', margin: 0 }}>Penilaian yang Difinalisasi</h2>
            <button className="smc-action-btn" onClick={() => navigate('/admin/manajemen-penilaian')} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '6px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: '#475569', cursor: 'pointer' }}>
              Lihat Semua
            </button>
          </div>

          {loading ? (
            <div className="loading-state" style={{ padding: '40px 0', textAlign: 'center', color: '#94a3b8' }}>Memuat data...</div>
          ) : evaluations.length === 0 ? (
            <div className="empty-state" style={{ padding: '40px 0', textAlign: 'center' }}>
              <p style={{ color: '#64748b', margin: 0 }}>Tidak ada penilaian yang difinalisasi bulan ini.</p>
            </div>
          ) : (
            <div className="table-container" style={{ padding: 0, overflowX: 'auto' }}>
              <table className="manajemen-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 600, color: '#475569', fontSize: '12px', textTransform: 'uppercase' }}>Nama</th>
                    <th style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 600, color: '#475569', fontSize: '12px', textTransform: 'uppercase' }}>Nilai</th>
                    <th style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 600, color: '#475569', fontSize: '12px', textTransform: 'uppercase' }}>Grade</th>
                    <th style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 600, color: '#475569', fontSize: '12px', textTransform: 'uppercase' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {evaluations.slice(0, 5).map((evaluation) => {
                    const user = typeof evaluation.userId === 'string' ? { name: evaluation.userId } : evaluation.userId;
                    
                    const getGradeColor = (score: number) => {
                      if (score >= 80) return '#10b981';
                      if (score >= 60) return '#f59e0b';
                      if (score >= 40) return '#f97316';
                      return '#ef4444';
                    };
                    const getGrade = (score: number) => {
                      if (score >= 90) return 'A+';
                      if (score >= 80) return 'A';
                      if (score >= 70) return 'B';
                      if (score >= 60) return 'C';
                      if (score >= 50) return 'D';
                      return 'E';
                    };

                    return (
                      <tr key={evaluation._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 8px', fontWeight: 600, color: '#1e293b' }}>
                          <div className="truncate-text" style={{ maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={(user as any)?.name || '-'}>
                            {(user as any)?.name || '-'}
                          </div>
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                          <strong style={{ color: getGradeColor(evaluation.hasil) }}>{evaluation.hasil}%</strong>
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                          <span style={{ background: getGradeColor(evaluation.hasil), color: 'white', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, display: 'inline-block', minWidth: '28px' }}>
                            {getGrade(evaluation.hasil)}
                          </span>
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                          <button
                            className="btn-delete"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleDeleteClick(evaluation._id, (user as any)?.name || 'Unknown');
                            }}
                            disabled={deleting === evaluation._id}
                            title="Hapus penilaian (reset ke Draft)"
                            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', border: '1px solid #fde8e8', background: '#fef2f2', color: '#ef4444', borderRadius: '8px', cursor: 'pointer', padding: 0 }}
                          >
                            {deleting === evaluation._id ? (
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite', width: '16px', height: '16px' }}>
                                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
                              </svg>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: 'none' }}>
                                <path d="M3 6h18" />
                                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                                <line x1="10" x2="10" y1="11" y2="17" />
                                <line x1="14" x2="14" y1="11" y2="17" />
                              </svg>
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Card 2: Kelola Foto Absensi */}
        <SuperManagePhotoManager />
      </div>

      <div className="super-manage-row super-manage-row-2">
         {/* Card 3: Kelola Data Admin (Table) */}
         <div className="super-manage-card smc-table-card">
          <div className="card-header" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '16px', marginBottom: '16px', background: 'transparent' }}>
            <h2 style={{ fontSize: '18px', margin: 0 }}>Daftar Admin Sistem</h2>
            <button className="smc-action-btn" onClick={() => navigate('/admin/super-manage/data-admin')} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '6px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: '#475569', cursor: 'pointer' }}>
              Lihat Semua
            </button>
          </div>

          {adminsLoading ? (
            <div className="loading-state" style={{ padding: '40px 0', textAlign: 'center', color: '#94a3b8' }}>Memuat data admin...</div>
          ) : admins.length === 0 ? (
            <div className="empty-state" style={{ padding: '40px 0', textAlign: 'center' }}>
              <p style={{ color: '#64748b', margin: 0 }}>Tidak ada data admin.</p>
            </div>
          ) : (
            <div className="table-container" style={{ padding: 0, overflowX: 'auto' }}>
              <table className="manajemen-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 600, color: '#475569', fontSize: '12px', textTransform: 'uppercase', width: '50px' }}>No</th>
                    <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 600, color: '#475569', fontSize: '12px', textTransform: 'uppercase' }}>Nama Admin</th>
                    <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 600, color: '#475569', fontSize: '12px', textTransform: 'uppercase' }}>Instansi / Jabatan</th>
                    <th style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 600, color: '#475569', fontSize: '12px', textTransform: 'uppercase' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {admins.slice(0, 5).map((adminData, idx) => (
                    <tr key={adminData._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 8px', color: '#64748b' }}>{idx + 1}</td>
                      <td style={{ padding: '12px 8px', fontWeight: 600, color: '#1e293b' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span>{adminData.name}</span>
                          <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 500 }}>{adminData.email || '-'}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 8px', color: '#475569' }}>
                        <div className="truncate-text" style={{ maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={adminData.instansi || '-'}>
                          {adminData.instansi || '-'}
                        </div>
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                        <span style={{ 
                          background: adminData.status === 'Aktif' ? '#dcfce7' : '#fee2e2', 
                          color: adminData.status === 'Aktif' ? '#166534' : '#991b1b', 
                          padding: '4px 10px', 
                          borderRadius: '6px', 
                          fontSize: '11px', 
                          fontWeight: 600, 
                          display: 'inline-block' 
                        }}>
                          {adminData.status || 'Aktif'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {createPortal(
        <div className={`modal-overlay ${confirmModal.show ? 'active' : ''}`} onClick={() => setConfirmModal({ ...confirmModal, show: false })}>
          <div className="modal-content reset-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-body-inner">
              <div className="modal-icon-wrapper">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="1.5">
                  <path d="M3 6h18"></path>
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                  <path d="M10 11v6"></path>
                  <path d="M14 11v6"></path>
                  <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"></path>
                </svg>
              </div>
              <div className="modal-text-content">
                <h3 className="modal-title">Reset Penilaian ke Draft</h3>
                <p className="modal-text">
                  Anda yakin ingin mereset penilaian
                  <strong style={{ marginLeft: 6 }}>{confirmModal.userName}</strong>?
                </p>
                <p className="modal-subtext">
                  Tindakan ini akan mereset penilaian menjadi <strong>Draft</strong>.
                </p>
              </div>
            </div>

            <div className="modal-actions">
              <button className="super-btn-secondary" onClick={() => setConfirmModal({ ...confirmModal, show: false })} disabled={deleting !== null}>
                Batal
              </button>
              <button className="super-btn-danger" onClick={handleConfirmDelete} disabled={deleting !== null}>
                {deleting ? 'Menghapus...' : 'Reset ke Draft'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
};

export default SuperManage;
