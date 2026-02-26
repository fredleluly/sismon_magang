import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { UsersAPI, PerformanceAPI } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import type { User, PerformanceEvaluation, PerformanceCalculation } from '../../types';
import MonthYearSelector from '../../components/MonthYearSelector';
import './PenilaianPerforma.css';

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const PenilaianPerforma: React.FC = () => {
  const { showToast } = useToast();
  const now = new Date();
  const [bulan, setBulan] = useState(now.getMonth() + 1);
  const [tahun, setTahun] = useState(now.getFullYear());

  // Users
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  // Calculation
  const [calculation, setCalculation] = useState<PerformanceCalculation | null>(null);
  const [calculating, setCalculating] = useState(false);

  // Manual inputs
  const [kuantitas, setKuantitas] = useState(0);
  const [kualitas, setKualitas] = useState(0);
  const [laporan, setLaporan] = useState(false);

  // Existing evaluations
  const [evaluations, setEvaluations] = useState<PerformanceEvaluation[]>([]);
  const [saving, setSaving] = useState(false);

  // Confirm modal
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    confirmText: string;
    type: 'danger' | 'success';
    onConfirm: () => void;
  }>({ show: false, title: '', message: '', confirmText: '', type: 'danger', onConfirm: () => {} });

  const showConfirm = (title: string, message: string, confirmText: string, type: 'danger' | 'success', onConfirm: () => void) => {
    setConfirmModal({ show: true, title, message, confirmText, type, onConfirm });
  };

  const closeConfirm = () => setConfirmModal(prev => ({ ...prev, show: false }));

  // Add pause/blur effect on modal open
  useEffect(() => {
    const app = document.querySelector('.app-wrapper');
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        closeConfirm();
      }
    };

    if (confirmModal.show) {
      document.body.style.overflow = 'hidden';
      if (app) app.classList.add('paused');
      window.addEventListener('keydown', escHandler, true);
    } else {
      document.body.style.overflow = 'unset';
      if (app) app.classList.remove('paused');
    }

    return () => {
      document.body.style.overflow = 'unset';
      if (app) app.classList.remove('paused');
      window.removeEventListener('keydown', escHandler, true);
    };
  }, [confirmModal.show]);

  // Load users
  useEffect(() => {
    const load = async () => {
      const res = await UsersAPI.getAll();
      if (res && res.success) setUsers((res.data || []).filter((u: User) => u.role === 'user'));
    };
    load();
  }, []);

  // Load existing evaluations
  const loadEvaluations = useCallback(async () => {
    const res = await PerformanceAPI.getAll(bulan, tahun);
    if (res && res.success) setEvaluations(res.data || []);
  }, [bulan, tahun]);

  useEffect(() => { loadEvaluations(); }, [loadEvaluations]);

  // Filter users for search
  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectUser = async (user: User) => {
    setSelectedUser(user);
    setSearchQuery(user.name);
    setShowDropdown(false);
    setCalculating(true);

    // Check if already evaluated
    const existing = evaluations.find(e => {
      const uid = typeof e.userId === 'string' ? e.userId : e.userId?._id;
      return uid === user._id;
    });
    
    if (existing) {
      setKuantitas(existing.kuantitas);
      setKualitas(existing.kualitas);
      setLaporan(existing.laporan);
    } else {
      setKuantitas(0);
      setKualitas(0);
      setLaporan(false);
    }

    // Calculate absen + kuantitas
    const res = await PerformanceAPI.calculate(user._id, bulan, tahun);
    if (res && res.success) {
      setCalculation(res.data);
    } else {
      showToast(res?.message || 'Gagal menghitung performa', 'error');
      setCalculation(null);
    }
    setCalculating(false);
  };

  const getHasil = () => {
    if (!calculation) return 0;
    const laporanVal = laporan ? 5 : 0;
    return parseFloat((calculation.absen + kuantitas + kualitas + laporanVal).toFixed(2));
  };

  const doSave = async (status: 'Draft' | 'Final') => {
    if (!selectedUser || !calculation || saving) return;
    setSaving(true);
    const res = await PerformanceAPI.save({
      userId: selectedUser._id,
      bulan, tahun,
      absen: calculation.absen,
      kuantitas: Number(kuantitas) || 0,
      kualitas: Number(kualitas) || 0,
      laporan,
      status,
    });

    try {
      if (res && res.success) {
        showToast(res.message || 'Berhasil disimpan!', 'success');
        loadEvaluations();
        // Reset form
        setSelectedUser(null);
        setSearchQuery('');
        setCalculation(null);
        setKuantitas(0);
        setKualitas(0);
        setLaporan(false);
      } else {
        showToast(res?.message || 'Gagal menyimpan', 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSave = (status: 'Draft' | 'Final') => {
    if (!selectedUser || !calculation) return;
    if (status === 'Final') {
      showConfirm(
        'Finalisasi Penilaian',
        'Yakin ingin memfinalisasi penilaian ini? Penilaian yang sudah final tidak bisa diubah.',
        'Ya, Finalisasi',
        'success',
        () => { closeConfirm(); doSave('Final'); }
      );
    } else {
      doSave('Draft');
    }
  };

  const handleDelete = (id: string) => {
    showConfirm(
      'Hapus Draft',
      'Yakin ingin menghapus draft penilaian ini?',
      'Ya, Hapus',
      'danger',
      async () => {
        closeConfirm();
        const res = await PerformanceAPI.delete(id);
        if (res && res.success) {
          showToast('Draft berhasil dihapus', 'success');
          loadEvaluations();
        } else {
          showToast(res?.message || 'Gagal menghapus', 'error');
        }
      }
    );
  };

  const handleEditExisting = (ev: PerformanceEvaluation) => {
    const user = typeof ev.userId === 'string' ? users.find(u => u._id === ev.userId) : ev.userId as User;
    if (user) handleSelectUser(user as User);
  };

  const handleDirectFinalize = (ev: PerformanceEvaluation) => {
    const user = typeof ev.userId === 'string' ? null : ev.userId as User;
    showConfirm(
      'Finalisasi Penilaian',
      `Yakin ingin memfinalisasi penilaian ${user?.name || ''}? Penilaian yang sudah final tidak bisa diubah.`,
      'Ya, Finalisasi',
      'success',
      async () => {
        closeConfirm();
        setSaving(true);
        try {
          const res = await PerformanceAPI.save({
            userId: typeof ev.userId === 'string' ? ev.userId : (ev.userId as User)._id,
            bulan: ev.bulan,
            tahun: ev.tahun,
            absen: ev.absen,
            kuantitas: Number(ev.kuantitas) || 0,
            kualitas: Number(ev.kualitas) || 0,
            laporan: ev.laporan,
            status: 'Final',
          });
          if (res && res.success) {
            showToast('Penilaian berhasil difinalisasi!', 'success');
            loadEvaluations();
          } else {
            showToast(res?.message || 'Gagal memfinalisasi', 'error');
          }
        } finally {
          setSaving(false);
        }
      }
    );
  };

  const getStatusBadge = (status: string) => (
    <span className={`status-badge ${status === 'Final' ? 'badge-final' : 'badge-draft'}`}>
      {status}
    </span>
  );

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#10b981';
    if (score >= 60) return '#f59e0b';
    if (score >= 40) return '#f97316';
    return '#ef4444';
  };

  return (
    <div className="penilaian-page">
      <div className="page-header-perf">
        <div className="page-header-content">
          <div className="page-icon-perf">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <div>
            <h1>Penilaian Performa</h1>
            <p>Evaluasi performa peserta magang berdasarkan absensi, kuantitas, kualitas, dan laporan</p>
          </div>
        </div>
      </div>

      {/* Month Selector */}
      <MonthYearSelector
        bulan={bulan}
        tahun={tahun}
        onBulanChange={setBulan}
        onTahunChange={setTahun}
      />

      {/* Evaluation Form */}
      <div className="eval-card">
        <div className="eval-card-header">
          <h2>Formulir Penilaian</h2>
          <p>Cari peserta lalu isi penilaian</p>
        </div>

        {/* User Search */}
        <div className="eval-card-body">
          <div className="search-section">
            <label>Cari Peserta</label>
            <div className="search-wrapper">
              <input
                type="text"
                placeholder="Ketik nama atau email peserta..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowDropdown(true);
                  if (!e.target.value) {
                    setSelectedUser(null);
                    setCalculation(null);
                  }
                }}
                onFocus={() => setShowDropdown(true)}
                className="search-input"
              />
              {showDropdown && searchQuery.length > 0 && (
                <div className="search-dropdown">
                  {filteredUsers.length === 0 ? (
                    <div className="search-empty">Tidak ditemukan</div>
                  ) : (
                    filteredUsers.map(u => (
                      <div
                        key={u._id}
                        className="search-item"
                        onClick={() => handleSelectUser(u)}
                      >
                        <div className="search-item-name">{u.name}</div>
                        <div className="search-item-email">{u.email}</div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Results Table */}
          {calculating && (
            <div className="calculating-msg">
              <span className="spinner" /> Menghitung performa...
            </div>
          )}

          {selectedUser && calculation && !calculating && (
            <>
              <div className="result-header">
                <h3 className="truncate-text" title={`Hasil Perhitungan — ${calculation.userName}`} style={{ maxWidth: '100%' }}>Hasil Perhitungan — {calculation.userName}</h3>
                <span className="result-period">{MONTHS[bulan - 1]} {tahun}</span>
              </div>

              <div className="score-grid">
                {/* Absen */}
                <div className="score-card">
                  <div className="score-label">Absen</div>
                  <div className="score-value" style={{ color: getScoreColor((calculation.absen / 35) * 100) }}>
                    {calculation.absen}
                  </div>
                  <div className="score-max">maks 35</div>
                  <div className="score-detail">
                    {calculation.detail.attendedDays}/{calculation.detail.totalWorkingDays} hari • Avg: {calculation.detail.avgPoints} pts
                  </div>
                </div>

                {/* Kuantitas */}
                <div className="score-card score-card-manual">
                  <div className="score-label">Kuantitas <span className="manual-badge">Manual</span></div>
                  <div className="score-input-wrap">
                    <input
                      type="number"
                      min="0"
                      max="30"
                      step="0.01"
                      value={kuantitas}
                      onChange={(e) => setKuantitas(Math.min(30, Math.max(0, parseFloat(e.target.value) || 0)))}
                      className="score-input"
                    />
                  </div>
                  <div className="score-max">maks 30</div>
                </div>

                {/* Kualitas */}
                <div className="score-card score-card-manual">
                  <div className="score-label">Kualitas <span className="manual-badge">Manual</span></div>
                  <div className="score-input-wrap">
                    <input
                      type="number"
                      min="0"
                      max="30"
                      step="0.01"
                      value={kualitas}
                      onChange={(e) => setKualitas(Math.min(30, Math.max(0, parseFloat(e.target.value) || 0)))}
                      className="score-input"
                    />
                  </div>
                  <div className="score-max">maks 30</div>
                </div>

                {/* Laporan */}
                <div className="score-card score-card-manual">
                  <div className="score-label">Laporan <span className="manual-badge">Manual</span></div>
                  <div className="score-checkbox-wrap">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={laporan}
                        onChange={(e) => setLaporan(e.target.checked)}
                        className="checkbox-input"
                      />
                      <span className="checkbox-custom" />
                      <span>{laporan ? '5' : '0'}</span>
                    </label>
                  </div>
                  <div className="score-max">maks 5</div>
                </div>
              </div>

              {/* Total */}
              <div className="total-score-bar">
                <div className="total-label">Hasil Akhir</div>
                <div className="total-value" style={{ color: getScoreColor(getHasil()) }}>
                  {getHasil()}
                </div>
                <div className="total-breakdown">
                  {calculation.absen} + {kuantitas} + {kualitas} + {laporan ? 5 : 0} = {getHasil()}
                </div>
              </div>

              {/* Actions */}
              <div className="eval-actions">
                <button className="btn btn-secondary" onClick={() => handleSave('Draft')} disabled={saving}>
                  {saving ? 'Menyimpan...' : 'Simpan Draft'}
                </button>
                <button className="btn btn-success" onClick={() => handleSave('Final')} disabled={saving}>
                  {saving ? 'Memfinalisasi...' : 'Finalisasi'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Existing Evaluations */}
      <div className="eval-card">
        <div className="eval-card-header">
          <h2>Daftar Penilaian — {MONTHS[bulan - 1]} {tahun}</h2>
          <p>{evaluations.length} penilaian</p>
        </div>
        <div className="eval-table-wrap max-h-[500px] overflow-y-auto">
          {evaluations.length === 0 ? (
            <div className="eval-empty">Belum ada penilaian untuk periode ini.</div>
          ) : (
            <table className="eval-table">
              <thead className="sticky top-0 z-[1] bg-white">
                <tr>
                  <th>No</th>
                  <th>Nama</th>
                  <th>Absen</th>
                  <th>Kuantitas</th>
                  <th>Kualitas</th>
                  <th>Laporan</th>
                  <th>Hasil</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {evaluations.map((ev, idx) => {
                  const user = typeof ev.userId === 'string' ? null : ev.userId as User;
                  return (
                    <tr key={ev._id}>
                      <td>{idx + 1}</td>
                      <td className="td-name truncate-text" title={user?.name || '-'}>{user?.name || '-'}</td>
                      <td>{ev.absen}</td>
                      <td>{ev.kuantitas}</td>
                      <td>{ev.kualitas}</td>
                      <td>{ev.laporan ? '5' : '0'}</td>
                      <td>
                        <span className="hasil-value" style={{ color: getScoreColor(ev.hasil) }}>
                          {ev.hasil}
                        </span>
                      </td>
                      <td>{getStatusBadge(ev.status)}</td>
                      <td className="td-actions">
                        {ev.status === 'Draft' && (
                          <>
                            <button className="btn-icon btn-finalize-eval" title="Kirim Final" onClick={() => handleDirectFinalize(ev)}>
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                                <line x1="22" y1="2" x2="11" y2="13" />
                                <polygon points="22 2 15 22 11 13 2 9 22 2" />
                              </svg>
                            </button>
                            <button className="btn-icon btn-edit-eval" title="Edit" onClick={() => handleEditExisting(ev)}>
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                                <path d="m15 5 4 4" />
                              </svg>
                            </button>
                            <button className="btn-icon btn-delete-eval" title="Hapus" onClick={() => handleDelete(ev._id)}>
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 6h18" />
                                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                                <line x1="10" x2="10" y1="11" y2="17" />
                                <line x1="14" x2="14" y1="11" y2="17" />
                              </svg>
                            </button>
                          </>
                        )}
                        {ev.status === 'Final' && <span className="finalized-label">✓ Final</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Confirm Modal */}
      {/* Confirm Modal (Portal) */}
      {confirmModal.show && ReactDOM.createPortal(
        <div className="modal-overlay active z-[9999]" onClick={(e) => { if (e.target === e.currentTarget) closeConfirm(); }}>
          <div className="modal-card max-w-[400px] text-center">
            <div className="modal-body pt-8 px-6 pb-6">
              <div className={`mx-auto mb-4 w-16 h-16 rounded-full flex items-center justify-center ${confirmModal.type === 'danger' ? 'bg-red-100 text-red-500' : 'bg-green-100 text-green-500'}`}>
                {confirmModal.type === 'danger' ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                )}
              </div>
              
              <h3 className="text-lg font-bold mb-2 text-gray-800">
                {confirmModal.title}
              </h3>
              <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                {confirmModal.message}
              </p>

              <div className="flex gap-3">
                <button 
                  className="btn-outline flex-1 justify-center" 
                  onClick={closeConfirm}
                >
                  Batal
                </button>
                <button 
                  className={`btn flex-1 justify-center ${confirmModal.type === 'danger' ? 'btn-danger' : 'btn-primary'}`} 
                  onClick={confirmModal.onConfirm}
                >
                  {confirmModal.confirmText}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default PenilaianPerforma;
