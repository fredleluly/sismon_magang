import React, { useEffect, useState, useCallback, useRef } from 'react';
import { exportRekapitulasiExcel } from '../../utils/excelExport';
import { useToast } from '../../context/ToastContext';
import { UsersAPI } from '../../services/api';
import { getToken } from '../../services/api';
import type { User } from '../../types';

interface RecapRow {
  userId: string;
  userName: string;
  jenis: string;
  berkas: number;
  buku: number;
  bundle: number;
}

interface PivotCell {
  berkas: number;
  buku: number;
  bundle: number;
  total: number;
}

interface PivotRow {
  userName: string;
  userId: string;
  cells: Record<string, PivotCell>;
  grandTotal: number;
}

const JENIS_LIST = [
  'Sortir',
  'Register',
  'Pencopotan Steples',
  'Scanning',
  'Rekardus',
  'Stikering',
];

const Rekapitulasi: React.FC = () => {
  const { showToast } = useToast();
  const [rawData, setRawData] = useState<RecapRow[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [showUserFilter, setShowUserFilter] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  // Load users list
  useEffect(() => {
    (async () => {
      const res = await UsersAPI.getAll();
      if (res && res.success) {
        const peserta = (res.data || []).filter((u: User) => u.role === 'user');
        setUsers(peserta);
      }
    })();
  }, []);

  // Close user filter dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setShowUserFilter(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchRecap = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.append('from', dateFrom);
      if (dateTo) params.append('to', dateTo);
      if (selectedUsers.length > 0) params.append('userIds', selectedUsers.join(','));

      const token = getToken();
      const res = await fetch(`/api/work-logs/recap?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const json = await res.json();
      if (json.success) {
        setRawData(json.data || []);
      } else {
        showToast('Gagal memuat data rekapitulasi', 'error');
      }
    } catch {
      showToast('Gagal memuat data rekapitulasi', 'error');
    }
    setLoading(false);
  }, [dateFrom, dateTo, selectedUsers]);

  useEffect(() => {
    fetchRecap();
  }, [fetchRecap]);

  // Build pivot table data
  const jenisList = JENIS_LIST;

  const pivotRows: PivotRow[] = (() => {
    const userMap: Record<string, PivotRow> = {};

    rawData.forEach((r) => {
      if (!userMap[r.userId]) {
        userMap[r.userId] = {
          userName: r.userName,
          userId: r.userId,
          cells: {},
          grandTotal: 0,
        };
        jenisList.forEach((j) => {
          userMap[r.userId].cells[j] = { berkas: 0, buku: 0, bundle: 0, total: 0 };
        });
      }
      const jKey = jenisList.find((j) => j.toLowerCase() === r.jenis.toLowerCase()) || r.jenis;
      if (!userMap[r.userId].cells[jKey]) {
        userMap[r.userId].cells[jKey] = { berkas: 0, buku: 0, bundle: 0, total: 0 };
      }
      userMap[r.userId].cells[jKey].berkas += r.berkas;
      userMap[r.userId].cells[jKey].buku += r.buku;
      userMap[r.userId].cells[jKey].bundle += r.bundle;
      userMap[r.userId].cells[jKey].total += r.berkas + r.buku + r.bundle;
    });

    // Calculate grand total
    Object.values(userMap).forEach((row) => {
      row.grandTotal = Object.values(row.cells).reduce((s, c) => s + c.total, 0);
    });

    return Object.values(userMap).sort((a, b) => a.userName.localeCompare(b.userName));
  })();

  // Totals row
  const totalsRow: Record<string, PivotCell> = {};
  jenisList.forEach((j) => {
    totalsRow[j] = { berkas: 0, buku: 0, bundle: 0, total: 0 };
  });
  let grandTotalAll = 0;
  pivotRows.forEach((row) => {
    jenisList.forEach((j) => {
      const c = row.cells[j] || { berkas: 0, buku: 0, bundle: 0, total: 0 };
      totalsRow[j].berkas += c.berkas;
      totalsRow[j].buku += c.buku;
      totalsRow[j].bundle += c.bundle;
      totalsRow[j].total += c.total;
    });
    grandTotalAll += row.grandTotal;
  });

  const toggleUser = (id: string) => {
    setSelectedUsers((prev) => (prev.includes(id) ? prev.filter((u) => u !== id) : [...prev, id]));
  };

  const selectAllUsers = () => {
    if (selectedUsers.length === users.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(users.map((u) => u._id));
    }
  };

  const exportToExcel = async () => {
    if (pivotRows.length === 0) {
      showToast('Tidak ada data untuk diekspor', 'error');
      return;
    }
    try {
      const filterInfo = dateFrom && dateTo
        ? `${new Date(dateFrom).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })} — ${new Date(dateTo).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`
        : undefined;
      await exportRekapitulasiExcel(
        jenisList,
        pivotRows,
        totalsRow,
        grandTotalAll,
        filterInfo,
      );
      showToast('Berhasil mengekspor data ke Excel', 'success');
    } catch {
      showToast('Gagal mengekspor data ke Excel', 'error');
    }
  };

  const formatDateLabel = () => {
    if (dateFrom && dateTo) {
      const f = new Date(dateFrom).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
      const t = new Date(dateTo).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
      return `${f} — ${t}`;
    }
    if (dateFrom) return `Dari ${new Date(dateFrom).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    if (dateTo) return `Sampai ${new Date(dateTo).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    return 'Semua Tanggal';
  };

  return (
    <>
      <div className="page-header-row">
        <div className="page-header">
          <h1>Rekapitulasi Pekerjaan</h1>
          <p>Rekap data pekerjaan seluruh peserta magang berdasarkan jenis pekerjaan</p>
        </div>
      </div>

      {/* Filters */}
      <div className="rekap-filters">
        <div className="rekap-filter-group">
          <label>Dari Tanggal</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rekap-input" />
        </div>
        <div className="rekap-filter-group">
          <label>Sampai Tanggal</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rekap-input" />
        </div>
        <div className="rekap-filter-group rekap-user-filter" ref={filterRef}>
          <label>Peserta</label>
          <button
            className="rekap-user-btn"
            onClick={() => setShowUserFilter(!showUserFilter)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
            </svg>
            {selectedUsers.length === 0
              ? 'Semua Peserta'
              : selectedUsers.length === users.length
                ? 'Semua Peserta'
                : `${selectedUsers.length} Peserta`}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'auto' }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {showUserFilter && (
            <div className="rekap-user-dropdown">
              <div className="rekap-user-option" onClick={selectAllUsers}>
                <input type="checkbox" checked={selectedUsers.length === users.length && users.length > 0} readOnly />
                <span style={{ fontWeight: 600 }}>Pilih Semua</span>
              </div>
              <div className="rekap-user-dropdown-divider" />
              {users.map((u) => (
                <div key={u._id} className="rekap-user-option" onClick={() => toggleUser(u._id)}>
                  <input type="checkbox" checked={selectedUsers.includes(u._id)} readOnly />
                  <span>{u.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="rekap-filter-actions">
          <button className="btn-export" onClick={exportToExcel}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export Excel
          </button>
        </div>
      </div>

      {/* Info bar */}
      <div className="rekap-info-bar">
        <span className="rekap-info-badge">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
          {formatDateLabel()}
        </span>
        <span className="rekap-info-badge">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>
          {pivotRows.length} Peserta
        </span>
        <span className="rekap-info-badge">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
          Total: {grandTotalAll.toLocaleString('id-ID')}
        </span>
      </div>

      {/* Table */}
      <div className="rekap-table-card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--gray-400)' }}>
            <div style={{ width: 36, height: 36, border: '3px solid var(--gray-200)', borderTop: '3px solid var(--primary-500)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
            Memuat data...
          </div>
        ) : (
          <div className="rekap-table-wrapper">
            <table className="rekap-table">
              <thead>
                <tr>
                  <th rowSpan={2} className="rekap-th-sticky">NAMA PESERTA</th>
                  {jenisList.map((j) => (
                    <th key={j} colSpan={4} className="rekap-th-group">{j.toUpperCase()}</th>
                  ))}
                  <th rowSpan={2} className="rekap-th-total">TOTAL</th>
                </tr>
                <tr>
                  {jenisList.map((j) => (
                    <React.Fragment key={j + '-sub'}>
                      <th className="rekap-th-sub">BERKAS</th>
                      <th className="rekap-th-sub">BUKU</th>
                      <th className="rekap-th-sub">BUNDLE</th>
                      <th className="rekap-th-sub rekap-th-sub-total">TOTAL</th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pivotRows.length === 0 ? (
                  <tr>
                    <td colSpan={jenisList.length * 4 + 2} style={{ textAlign: 'center', padding: 40, color: 'var(--gray-400)' }}>
                      Belum ada data rekapitulasi
                    </td>
                  </tr>
                ) : (
                  <>
                    {pivotRows.map((row) => (
                      <tr key={row.userId}>
                        <td className="rekap-td-name">{row.userName}</td>
                        {jenisList.map((j) => {
                          const c = row.cells[j] || { berkas: 0, buku: 0, bundle: 0, total: 0 };
                          return (
                            <React.Fragment key={j}>
                              <td className="rekap-td-num">{c.berkas}</td>
                              <td className="rekap-td-num">{c.buku}</td>
                              <td className="rekap-td-num">{c.bundle}</td>
                              <td className="rekap-td-num rekap-td-subtotal">{c.total}</td>
                            </React.Fragment>
                          );
                        })}
                        <td className="rekap-td-num rekap-td-grandtotal">{row.grandTotal}</td>
                      </tr>
                    ))}
                    <tr className="rekap-total-row">
                      <td className="rekap-td-name" style={{ fontWeight: 800 }}>TOTAL</td>
                      {jenisList.map((j) => (
                        <React.Fragment key={j + '-tot'}>
                          <td className="rekap-td-num">{totalsRow[j].berkas}</td>
                          <td className="rekap-td-num">{totalsRow[j].buku}</td>
                          <td className="rekap-td-num">{totalsRow[j].bundle}</td>
                          <td className="rekap-td-num rekap-td-subtotal">{totalsRow[j].total}</td>
                        </React.Fragment>
                      ))}
                      <td className="rekap-td-num rekap-td-grandtotal">{grandTotalAll}</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
};

export default Rekapitulasi;
