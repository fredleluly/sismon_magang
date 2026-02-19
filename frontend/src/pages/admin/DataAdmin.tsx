import React, { useState, useEffect, useCallback } from "react";
import ReactDOM from "react-dom";
import { UsersAPI } from "../../services/api";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import type { User } from "../../types";

const DataAdmin: React.FC = () => {
  const { showToast } = useToast();
  const { user } = useAuth();
  const [admins, setAdmins] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    username: "",
    password: "",
  });

  const [deleteConfirm, setDeleteConfirm] = useState<{
    show: boolean;
    id: string | null;
  }>({ show: false, id: null });

  const load = useCallback(async () => {
    try {
      const res = await UsersAPI.getAdmins();
      if (res && res.success) setAdmins(res.data || []);
    } catch (err) {
      showToast("Gagal memuat data admin", "error");
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const app = document.querySelector(".app-wrapper");
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };

    if (modal) {
      document.body.style.overflow = "hidden";
      if (app) app.classList.add("paused");
      window.addEventListener("keydown", escHandler, true);
    } else {
      document.body.style.overflow = "unset";
      if (app) app.classList.remove("paused");
    }

    return () => {
      document.body.style.overflow = "unset";
      if (app) app.classList.remove("paused");
      window.removeEventListener("keydown", escHandler, true);
    };
  }, [modal]);

  const filtered = admins.filter(
    (a) =>
      (a.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (a.email || "").toLowerCase().includes(search.toLowerCase()) ||
      (a.username || "").toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => {
    setEditingId(null);
    setForm({ name: "", email: "", username: "", password: "" });
    setModal(true);
  };

  const openEdit = (admin: User) => {
    setEditingId(admin._id);
    setForm({
      name: admin.name,
      email: admin.email,
      username: admin.username || "",
      password: "",
    });
    setModal(true);
  };

  const save = async () => {
    if (!form.name || !form.email) {
      showToast("Nama dan email wajib diisi!", "error");
      return;
    }
    try {
      if (editingId) {
        // Update existing admin
        const res = await UsersAPI.updateAdmin(editingId, {
          name: form.name,
          email: form.email,
          username: form.username,
        });
        if (res && res.success) {
          showToast(res.message || "Admin berhasil diupdate", "success");
          setModal(false);
          load();
        } else {
          showToast(res?.message || "Gagal mengupdate admin", "error");
        }
      } else {
        // Create new admin
        const res = await UsersAPI.createAdmin({
          name: form.name,
          email: form.email,
          username: form.username,
          password: form.password || "admin123",
        });
        if (res && res.success) {
          showToast(res.message || "Admin berhasil ditambahkan", "success");
          setModal(false);
          load();
        } else {
          showToast(res?.message || "Gagal menambahkan admin", "error");
        }
      }
    } catch (err) {
      showToast("Terjadi kesalahan", "error");
    }
  };

  const del = async (id: string) => {
    setDeleteConfirm({ show: true, id });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm.id) return;
    try {
      const res = await UsersAPI.deleteAdmin(deleteConfirm.id);
      if (res && res.success) {
        showToast("Admin berhasil dihapus", "success");
        load();
      } else {
        showToast(res?.message || "Gagal menghapus admin", "error");
      }
    } catch (err) {
      showToast("Terjadi kesalahan", "error");
    }
    setDeleteConfirm({ show: false, id: null });
  };

  const avColors = ["av-a", "av-b", "av-c", "av-d", "av-e"];

  // Only superadmin can access this page
  if (user?.role !== "superadmin") {
    return (
      <div className="page-content">
        <div className="peserta-table-card" style={{ textAlign: "center", padding: "60px" }}>
          <h2>Akses Ditolak</h2>
          <p>Halaman ini hanya dapat diakses oleh Superadmin.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="page-header-row">
        <div className="page-header">
          <h1>Data Admin</h1>
          <p>Kelola data admin sistem</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          Tambah Admin
        </button>
      </div>
      <div className="peserta-table-card">
        <div className="peserta-table-header">
          <div className="pth-left">
            <h3>Daftar Admin</h3>
          </div>
          <div className="peserta-search">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama, email, atau username..."
            />
          </div>
        </div>
        <div className="peserta-table-wrapper">
          <table className="peserta-table">
            <thead>
              <tr>
                <th>Nama</th>
                <th>Username</th>
                <th>Email</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a, i) => {
                const initials = (a.name || "")
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .substring(0, 2)
                  .toUpperCase();
                return (
                  <tr key={a._id}>
                    <td>
                      <div className="user-cell">
                        <div className={`user-avatar ${avColors[i % 5]}`}>
                          {initials}
                        </div>
                        <div>
                          <div className="user-name">{a.name}</div>
                          <div className="user-email">{a.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="data-highlight">
                        {a.username || "-"}
                      </span>
                    </td>
                    <td>{a.email}</td>
                    <td>
                      <span
                        className={`status-badge ${(
                          a.status || "Aktif"
                        ).toLowerCase()}`}
                      >
                        {a.status || "Aktif"}
                      </span>
                    </td>
                    <td>
                      <div className="action-btns">
                        <button
                          className="action-btn edit"
                          onClick={() => openEdit(a)}
                          title="Edit Admin"
                        >
                          ✏️
                        </button>
                        <button
                          className="action-btn delete"
                          onClick={() => del(a._id)}
                          title="Hapus Admin"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {deleteConfirm.show &&
            ReactDOM.createPortal(
              <div className="modal-overlay active">
                <div className="modal-card modal-delete-confirm">
                  <div className="modal-header">
                    <h3>Konfirmasi Penghapusan</h3>
                    <div
                      className="modal-close"
                      onClick={() =>
                        setDeleteConfirm({ show: false, id: null })
                      }
                    >
                      ✕
                    </div>
                  </div>
                  <div className="modal-body">
                    <p
                      style={{
                        textAlign: "center",
                        color: "#666",
                        marginBottom: "20px",
                      }}
                    >
                      Apakah Anda yakin ingin menghapus admin ini? Tindakan ini
                      tidak dapat dibatalkan.
                    </p>
                  </div>
                  <div className="modal-footer">
                    <button
                      className="btn-outline"
                      onClick={() =>
                        setDeleteConfirm({ show: false, id: null })
                      }
                    >
                      Batal
                    </button>
                    <button className="btn btn-danger" onClick={confirmDelete}>
                      Hapus Admin
                    </button>
                  </div>
                </div>
              </div>,
              document.body
            )}
        </div>
      </div>
      {modal &&
        ReactDOM.createPortal(
          <div className="modal-overlay active">
            <div className="modal-card">
              <div className="modal-header">
                <h3>{editingId ? 'Edit Admin' : 'Tambah Admin'}</h3>
                <div className="modal-close" onClick={() => setModal(false)}>
                  ✕
                </div>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label>Nama Lengkap</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) =>
                      setForm({ ...form, name: e.target.value })
                    }
                    placeholder="Nama lengkap"
                  />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                    placeholder="email@example.com"
                  />
                </div>
                <div className="form-group">
                  <label>Username</label>
                  <input
                    type="text"
                    value={form.username}
                    onChange={(e) =>
                      setForm({ ...form, username: e.target.value })
                    }
                    placeholder="Username untuk login"
                  />
                </div>
                {!editingId && (
                  <div className="form-group">
                    <label>Password</label>
                    <input
                      type="password"
                      value={form.password}
                      onChange={(e) =>
                        setForm({ ...form, password: e.target.value })
                      }
                      placeholder="Default: admin123"
                    />
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button
                  className="btn-outline"
                  disabled
                  title="Gunakan tombol ✕ untuk menutup"
                >
                  Batal
                </button>
                <button className="btn btn-primary" onClick={save}>
                  Simpan
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

export default DataAdmin;
