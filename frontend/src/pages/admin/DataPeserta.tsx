import React, { useEffect, useState, useCallback } from 'react';
import { UsersAPI } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import type { User } from '../../types';

const DataPeserta: React.FC = () => {
  const { showToast } = useToast();
  const [peserta, setPeserta] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [editingId, setEditingId] = useState<string|null>(null);
  const [form, setForm] = useState({name:'',email:'',instansi:'',password:'',status:'Aktif'});

  const load = useCallback(async () => {
    const res = await UsersAPI.getAll();
    if (res && res.success) setPeserta(res.data || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = peserta.filter(p => (p.name||'').toLowerCase().includes(search.toLowerCase()) || (p.instansi||'').toLowerCase().includes(search.toLowerCase()));

  const openAdd = () => { setEditingId(null); setForm({name:'',email:'',instansi:'',password:'',status:'Aktif'}); setModal(true); };
  const openEdit = (id: string) => {
    const p = peserta.find(x=>x._id===id);
    if (!p) return;
    setEditingId(id); setForm({name:p.name,email:p.email,instansi:p.instansi||'',password:'',status:p.status||'Aktif'}); setModal(true);
  };

  const save = async () => {
    if (!form.name || !form.email) { showToast('Nama dan email wajib diisi!','error'); return; }
    let res;
    if (editingId) { res = await UsersAPI.update(editingId, { name:form.name,email:form.email,instansi:form.instansi,status:form.status }); }
    else { res = await UsersAPI.create({ name:form.name,email:form.email,instansi:form.instansi,password:form.password||'magang123' } as any); }
    if (res && res.success) { showToast(res.message||'Berhasil','success'); setModal(false); load(); }
    else showToast(res?.message || 'Gagal','error');
  };

  const del = async (id: string) => {
    if (!confirm('Yakin ingin menghapus?')) return;
    const res = await UsersAPI.delete(id);
    if (res && res.success) { showToast('Berhasil dihapus','success'); load(); }
    else showToast(res?.message||'Gagal','error');
  };

  const avColors = ['av-a','av-b','av-c','av-d','av-e'];

  return (
    <>
      <div className="page-header-row"><div className="page-header"><h1>Data Peserta Magang</h1><p>Kelola dan pantau data peserta magang PLN ICON+</p></div><button className="btn btn-primary" onClick={openAdd}>Tambah Peserta</button></div>
      <div className="peserta-table-card">
        <div className="peserta-table-header">
          <div className="pth-left"><h3>Daftar Peserta Magang</h3></div>
          <div className="peserta-search"><input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari nama atau instansi..." /></div>
        </div>
        <table className="peserta-table">
          <thead><tr><th>Nama</th><th>Instansi</th><th>Berkas</th><th>Buku</th><th>Bundle</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody>{filtered.map((p,i) => {
            const initials = (p.name||'').split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase();
            return <tr key={p._id}>
              <td><div className="user-cell"><div className={`user-avatar ${avColors[i%5]}`}>{initials}</div><div><div className="user-name">{p.name}</div><div className="user-email">{p.email}</div></div></div></td>
              <td>{p.instansi||'-'}</td><td><span className="data-highlight">{(p.totalBerkas||0).toLocaleString()}</span></td><td><span className="data-highlight">{p.totalBuku||0}</span></td><td><span className="data-highlight">{p.totalBundle||0}</span></td>
              <td><span className={`status-badge ${(p.status||'Aktif').toLowerCase()}`}>{p.status||'Aktif'}</span></td>
              <td><div className="action-btns"><button className="action-btn edit" onClick={()=>openEdit(p._id)}>✏️</button><button className="action-btn delete" onClick={()=>del(p._id)}>🗑️</button></div></td>
            </tr>;
          })}</tbody>
        </table>
      </div>
      {modal && <div className="modal-overlay active" onClick={e=>{if(e.target===e.currentTarget)setModal(false)}}>
        <div className="modal-card">
          <div className="modal-header"><h3>{editingId?'Edit Data Peserta':'Tambah Peserta'}</h3><div className="modal-close" onClick={()=>setModal(false)}>✕</div></div>
          <div className="modal-body">
            <div className="form-group"><label>Nama Lengkap</label><input type="text" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Nama lengkap" /></div>
            <div className="form-group"><label>Email</label><input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="email@example.com" /></div>
            <div className="form-group"><label>Instansi</label><input type="text" value={form.instansi} onChange={e=>setForm({...form,instansi:e.target.value})} placeholder="Universitas" /></div>
            {!editingId && <div className="form-group"><label>Password</label><input type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="Default: magang123" /></div>}
          </div>
          <div className="modal-footer"><button className="btn-outline" onClick={()=>setModal(false)}>Batal</button><button className="btn btn-primary" onClick={save}>Simpan</button></div>
        </div>
      </div>}
    </>
  );
};

export default DataPeserta;
