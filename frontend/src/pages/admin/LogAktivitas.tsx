import React, { useEffect, useState, useCallback } from 'react';
import { exportExcel } from '../../utils/excelExport';
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

  const exportToExcel = async () => {
    if (filtered.length === 0) {
      showToast('Tidak ada data untuk diekspor', 'error');
      return;
    }
    try {
      const totalBerkas = filtered.reduce((s, l) => s + (l.berkas || 0), 0);
      const totalBuku = filtered.reduce((s, l) => s + (l.buku || 0), 0);
      const totalBundle = filtered.reduce((s, l) => s + (l.bundle || 0), 0);

      await exportExcel({
        fileName: 'Log_Aktivitas',
        companyName: 'SISMON Magang',
        sheets: [{
          sheetName: 'Log Aktivitas',
          title: 'LOG AKTIVITAS PEKERJAAN',
          subtitle: 'Laporan Aktivitas Peserta Magang',
          infoLines: [
            `Total Data: ${filtered.length} aktivitas`,
            `Dicetak: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`,
          ],
          columns: [
            { header: 'No', key: 'no', width: 6, type: 'number' },
            { header: 'Nama Peserta', key: 'nama', width: 24 },
            { header: 'Tanggal', key: 'tanggal', width: 22, type: 'date' },
            { header: 'Jenis Pekerjaan', key: 'jenis', width: 20 },
            { header: 'Keterangan', key: 'keterangan', width: 28 },
            { header: 'Berkas', key: 'berkas', width: 10, type: 'number' },
            { header: 'Buku', key: 'buku', width: 10, type: 'number' },
            { header: 'Bundle', key: 'bundle', width: 10, type: 'number' },
          ],
          data: filtered.map((l, i) => ({
            no: i + 1,
            nama: (l.userId as any)?.name || 'Unknown',
            tanggal: l.tanggal ? new Date(l.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-',
            jenis: l.jenis || '-',
            keterangan: l.keterangan || '-',
            berkas: l.berkas || 0,
            buku: l.buku || 0,
            bundle: l.bundle || 0,
          })),
          summaryRow: {
            no: '',
            nama: '',
            tanggal: '',
            jenis: '',
            keterangan: '',
            berkas: totalBerkas,
            buku: totalBuku,
            bundle: totalBundle,
          },
          summaryLabel: 'TOTAL',
        }],
      });
      showToast('Berhasil mengekspor data ke Excel', 'success');
    } catch {
      showToast('Gagal mengekspor data ke Excel', 'error');
    }
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
