import React, { useEffect, useState, useCallback } from 'react';
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

  return (
    <>
      <div className="page-header-row"><div className="page-header"><h1>Log Aktivitas</h1><p>Pantau aktivitas pekerjaan seluruh peserta magang</p></div></div>
      <div className="log-table-card">
        <div className="peserta-table-header">
          <div className="pth-left"><h3>Aktivitas Terbaru</h3></div>
          <div className="peserta-search"><input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari aktivitas..." /></div>
        </div>
        <table className="log-table">
          <thead><tr><th>Nama Peserta</th><th>Tanggal</th><th>Jenis Pekerjaan</th><th>Keterangan</th><th>Berkas</th><th>Buku</th><th>Bundle</th></tr></thead>
          <tbody>{filtered.length===0?<tr><td colSpan={7} style={{textAlign:'center',padding:40,color:'var(--gray-400)'}}>Belum ada data</td></tr>:
          filtered.map((l,i)=>{
            const name = (l.userId as any)?.name||'Unknown';
            const initials = name.split(' ').map((n:string)=>n[0]).join('').substring(0,2).toUpperCase();
            const dateStr = l.tanggal ? new Date(l.tanggal).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'}) : '-';
            return <tr key={l._id}><td><div className="user-cell"><div className={`user-avatar ${avColors[i%5]}`}>{initials}</div><span className="user-name">{name}</span></div></td><td>{dateStr}</td><td><span className="job-badge">{l.jenis||'-'}</span></td><td>{l.keterangan||'-'}</td><td><span className="data-highlight">{l.berkas||0}</span></td><td><span className="data-highlight">{l.buku||0}</span></td><td><span className="data-highlight">{l.bundle||0}</span></td></tr>;
          })}</tbody>
        </table>
      </div>
    </>
  );
};

export default LogAktivitas;
