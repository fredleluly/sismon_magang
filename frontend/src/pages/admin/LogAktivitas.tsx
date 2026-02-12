import React, { useEffect, useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { WorkLogAPI } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import type { WorkLog } from '../../types';

const LogAktivitas: React.FC = () => {
  const { showToast } = useToast();
  const [logs, setLogs] = useState<WorkLog[]>([]);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    const res = await WorkLogAPI.getAll('status=Selesai');
    if (res && res.success) setLogs(res.data || []);
    else showToast('Gagal memuat data', 'error');
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = logs.filter(l => {
    const q = search.toLowerCase();
    return (l.userId as any)?.name?.toLowerCase().includes(q) || (l.jenis||'').toLowerCase().includes(q) || (l.keterangan||'').toLowerCase().includes(q);
  });

  const avColors = ['av-a','av-b','av-c','av-d','av-e'];

  const exportToExcel = () => {
    if (filtered.length === 0) {
      showToast('Tidak ada data untuk diekspor', 'error');
      return;
    }
    const data = filtered.map((l, i) => ({
      'No': i + 1,
      'Nama Peserta': (l.userId as any)?.name || 'Unknown',
      'Tanggal': l.tanggal ? new Date(l.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-',
      'Jenis Pekerjaan': l.jenis || '-',
      'Keterangan': l.keterangan || '-',
      'Berkas': l.berkas || 0,
      'Buku': l.buku || 0,
      'Bundle': l.bundle || 0,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    // Auto-size columns
    const colWidths = Object.keys(data[0]).map(key => ({
      wch: Math.max(key.length, ...data.map(row => String((row as any)[key]).length)) + 2,
    }));
    ws['!cols'] = colWidths;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Log Aktivitas');
    const today = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
    XLSX.writeFile(wb, `Log_Aktivitas_${today}.xlsx`);
    showToast('Berhasil mengekspor data ke Excel', 'success');
  };

  return (
    <>
      <div className="page-header-row"><div className="page-header"><h1>Log Aktivitas</h1><p>Pantau aktivitas pekerjaan seluruh peserta magang</p></div></div>
      <div className="log-table-card">
        <div className="peserta-table-header">
          <div className="pth-left"><h3>Aktivitas Terbaru</h3></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button className="btn-export" onClick={exportToExcel}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Export Excel
            </button>
            <div className="peserta-search"><input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari aktivitas..." /></div>
          </div>
        </div>
        <div className="table-container" style={{ maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
          <table className="log-table">
            <thead style={{ position: 'sticky', top: 0, zIndex: 1, backgroundColor: 'white' }}>
              <tr>
                <th>Nama Peserta</th>
                <th>Tanggal</th>
                <th>Jenis Pekerjaan</th>
                <th>Keterangan</th>
                <th>Berkas</th>
                <th>Buku</th>
                <th>Bundle</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--gray-400)' }}>
                    Belum ada data
                  </td>
                </tr>
              ) : (
                filtered.map((l, i) => {
                  const name = (l.userId as any)?.name || 'Unknown';
                  const dateStr = l.tanggal ? new Date(l.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
                  return (
                    <tr key={l._id}>
                      <td>
                        <div className="user-cell">
                          <span className="user-name">{name}</span>
                        </div>
                      </td>
                      <td>{dateStr}</td>
                      <td>
                        <span className="job-badge">{l.jenis || '-'}</span>
                      </td>
                      <td style={{ maxWidth: 300, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={l.keterangan || '-'}>{l.keterangan || '-'}</td>
                      <td>
                        <span className="data-highlight">{l.berkas || 0}</span>
                      </td>
                      <td>
                        <span className="data-highlight">{l.buku || 0}</span>
                      </td>
                      <td>
                        <span className="data-highlight">{l.bundle || 0}</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

export default LogAktivitas;
