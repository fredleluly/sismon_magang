import React, { useEffect, useState, useCallback } from 'react';
import { ComplaintAPI } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import type { Complaint } from '../../types';

const KelolaKeluhan: React.FC = () => {
  const { showToast } = useToast();
  const [all, setAll] = useState<Complaint[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [prioFilter, setPrioFilter] = useState('');

  const load = useCallback(async () => {
    const res = await ComplaintAPI.getAll();
    if (res && res.success) setAll(res.data || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = all.filter(k => {
    const q = search.toLowerCase();
    const matchQ = !q || (k.judul||'').toLowerCase().includes(q) || (k.deskripsi||'').toLowerCase().includes(q) || ((k.userId as any)?.name||'').toLowerCase().includes(q);
    const matchS = !statusFilter || k.status === statusFilter;
    const matchP = !prioFilter || k.prioritas === prioFilter;
    return matchQ && matchS && matchP;
  });

  const menunggu = all.filter(k=>k.status==='Menunggu').length;
  const diproses = all.filter(k=>k.status==='Diproses').length;
  const selesai = all.filter(k=>k.status==='Selesai').length;

  const updateStatus = async (id: string, status: string) => {
    const res = await ComplaintAPI.updateStatus(id, status);
    if (res && res.success) { showToast(`Status diubah ke "${status}"`, 'success'); load(); }
    else showToast(res?.message || 'Gagal', 'error');
  };

  return (
    <>
      <div className="page-header"><h1>Kelola Keluhan</h1><p>Kelola dan tanggapi laporan keluhan dari peserta magang</p></div>
      <div className="keluhan-stats-grid">
        <div className="keluhan-stat"><div className="ks-header"><span className="ks-label">Total</span></div><div className="ks-value">{all.length}</div></div>
        <div className="keluhan-stat"><div className="ks-header"><span className="ks-label">Menunggu</span></div><div className="ks-value">{menunggu}</div></div>
        <div className="keluhan-stat"><div className="ks-header"><span className="ks-label">Diproses</span></div><div className="ks-value">{diproses}</div></div>
        <div className="keluhan-stat"><div className="ks-header"><span className="ks-label">Selesai</span></div><div className="ks-value">{selesai}</div></div>
      </div>
      <div className="filter-card"><div className="filter-row" style={{display:'flex',gap:12,flexWrap:'wrap'}}>
        <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari laporan..." style={{flex:1,minWidth:200,padding:'10px 16px',border:'1px solid var(--gray-200)',borderRadius:'var(--radius-md)',fontSize:13}} />
        <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} style={{padding:'10px 16px',border:'1px solid var(--gray-200)',borderRadius:'var(--radius-md)',fontSize:13}}><option value="">Semua Status</option><option>Menunggu</option><option>Diproses</option><option>Selesai</option></select>
        <select value={prioFilter} onChange={e=>setPrioFilter(e.target.value)} style={{padding:'10px 16px',border:'1px solid var(--gray-200)',borderRadius:'var(--radius-md)',fontSize:13}}><option value="">Semua Prioritas</option><option>High</option><option>Medium</option><option>Low</option></select>
      </div></div>
      <div className="keluhan-list-card" style={{marginTop:20}}>
        <h3>Daftar Keluhan</h3><p style={{fontSize:13,color:'var(--gray-500)',marginBottom:16}}>Menampilkan {filtered.length} dari {all.length} laporan</p>
        {filtered.length===0?<div style={{textAlign:'center',padding:40,color:'var(--gray-400)'}}>Tidak ada laporan ditemukan</div>:
        filtered.map((k,i) => {
          const date = k.createdAt ? new Date(k.createdAt).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'}) : '-';
          const userName = (k.userId as any)?.name || 'Unknown';
          const prioClass = k.prioritas==='High'?'high':k.prioritas==='Medium'?'medium':'low';
          const statusStyle = k.status==='Menunggu'?{background:'#fef3c7',color:'#d97706'}:k.status==='Diproses'?{background:'var(--primary-50)',color:'var(--primary-600)'}:{background:'#e6f9f0',color:'#059669'};
          return <div key={k._id} style={{padding:20,border:'1px solid var(--gray-200)',borderRadius:'var(--radius-md)',marginBottom:12}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}><span style={{fontSize:15,fontWeight:600,color:'var(--gray-800)'}}>{k.judul||'Tanpa Judul'}</span><span style={{fontSize:12,color:'var(--gray-400)'}}>{date}</span></div>
            <div style={{fontSize:13,color:'var(--gray-500)',marginBottom:4}}><strong>{userName}</strong></div>
            <div style={{fontSize:13,color:'var(--gray-500)',marginBottom:12}}>{(k.deskripsi||'').substring(0,120)}</div>
            <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
              <span style={{display:'inline-flex',padding:'3px 12px',borderRadius:'var(--radius-full)',fontSize:11,fontWeight:600,...statusStyle}}>{k.status}</span>
              <span className={`priority-badge ${prioClass}`}>{k.prioritas}</span>
              <span className="category-badge">{k.kategori}</span>
              {k.status!=='Selesai' && <div style={{marginLeft:'auto',display:'flex',gap:6}}>
                <button className="btn-outline" style={{padding:'5px 14px',fontSize:11}} onClick={()=>updateStatus(k._id,'Diproses')}>Proses</button>
                <button className="btn btn-primary" style={{padding:'5px 14px',fontSize:11}} onClick={()=>updateStatus(k._id,'Selesai')}>Selesai</button>
              </div>}
            </div>
          </div>;
        })}
      </div>
    </>
  );
};

export default KelolaKeluhan;
