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
      <div className="filter-card"><div className="filter-row flex gap-3 flex-wrap">
        <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari laporan..." className="flex-1 min-w-[200px] px-4 py-2.5 border border-gray-200 rounded-lg text-[13px]" />
        <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="px-4 py-2.5 border border-gray-200 rounded-lg text-[13px]"><option value="">Semua Status</option><option>Menunggu</option><option>Diproses</option><option>Selesai</option></select>
        <select value={prioFilter} onChange={e=>setPrioFilter(e.target.value)} className="px-4 py-2.5 border border-gray-200 rounded-lg text-[13px]"><option value="">Semua Prioritas</option><option>High</option><option>Medium</option><option>Low</option></select>
      </div></div>
      <div className="keluhan-list-card mt-5">
        <h3>Daftar Keluhan</h3><p className="text-[13px] text-gray-500 mb-4">Menampilkan {filtered.length} dari {all.length} laporan</p>
        <div className="keluhan-scroll-container max-h-[500px] overflow-y-auto pr-1">
          {filtered.length === 0 ? (
            <div className="text-center p-10 text-gray-400">Tidak ada laporan ditemukan</div>
          ) : (
            filtered.map((k, i) => {
              const date = k.createdAt ? new Date(k.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
              const userName = (k.userId as any)?.name || 'Unknown';
              const prioClass = k.prioritas === 'High' ? 'high' : k.prioritas === 'Medium' ? 'medium' : 'low';
              const statusCls = k.status === 'Menunggu' ? 'bg-amber-100 text-amber-600' : k.status === 'Diproses' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-100 text-emerald-600';
              return (
                <div key={k._id} className="p-5 border border-gray-200 rounded-lg mb-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[15px] font-semibold text-gray-800">{k.judul || 'Tanpa Judul'}</span>
                    <span className="text-xs text-gray-400">{date}</span>
                  </div>
                  <div className="text-[13px] text-gray-500 mb-1">
                    <strong>{userName}</strong>
                  </div>
                  <div className="text-[13px] text-gray-500 mb-3">{(k.deskripsi || '').substring(0, 120)}</div>
                  <div className="flex gap-2 items-center flex-wrap">
                    <span className={`inline-flex px-3 py-0.5 rounded-full text-[11px] font-semibold ${statusCls}`}>{k.status}</span>
                    <span className={`priority-badge ${prioClass}`}>{k.prioritas}</span>
                    <span className="category-badge">{k.kategori}</span>
                    {k.status !== 'Selesai' && (
                      <div className="ml-auto flex gap-1.5">
                        <button className="btn-outline px-3.5 py-1 text-[11px]" onClick={() => updateStatus(k._id, 'Diproses')}>
                          Proses
                        </button>
                        <button className="btn btn-primary px-3.5 py-1 text-[11px]" onClick={() => updateStatus(k._id, 'Selesai')}>
                          Selesai
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
};

export default KelolaKeluhan;
