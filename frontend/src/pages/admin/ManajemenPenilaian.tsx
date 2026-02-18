import React, { useState, useEffect, useCallback } from "react";
import { PerformanceAPI } from "../../services/api";
import { useToast } from "../../context/ToastContext";
import type { PerformanceEvaluation, User } from "../../types";
import "./ManajemenPenilaian.css";

const MONTHS = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

const ManajemenPenilaian: React.FC = () => {
  const { showToast } = useToast();
  const now = new Date();

  const [bulan, setBulan] = useState(now.getMonth() + 1);
  const [tahun, setTahun] = useState(now.getFullYear());
  const [evaluations, setEvaluations] = useState<PerformanceEvaluation[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Modal confirm
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    evaluationId: string;
    userName: string;
  }>({ show: false, evaluationId: "", userName: "" });

  // Load finalized evaluations
  const loadEvaluations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await PerformanceAPI.getAll(bulan, tahun);
      if (res && res.success) {
        // Filter hanya yang status "Final"
        const finalizedOnly = (res.data || []).filter(
          (e: PerformanceEvaluation) => e.status === "Final",
        );
        setEvaluations(finalizedOnly);
      } else {
        showToast("Gagal memuat penilaian", "error");
      }
    } catch (error) {
      console.error(error);
      showToast("Gagal memuat penilaian", "error");
    } finally {
      setLoading(false);
    }
  }, [bulan, tahun, showToast]);

  useEffect(() => {
    loadEvaluations();
  }, [loadEvaluations]);

  const handleDeleteClick = (evalId: string, userName: string) => {
    setConfirmModal({ show: true, evaluationId: evalId, userName });
  };

  const handleConfirmDelete = async () => {
    const evalId = confirmModal.evaluationId;
    setDeleting(evalId);

    try {
      const res = await PerformanceAPI.delete(evalId);

      if (res && res.success) {
        showToast("Penilaian berhasil dihapus", "success");
        setEvaluations((prev) => prev.filter((e) => e._id !== evalId));
        setConfirmModal({ show: false, evaluationId: "", userName: "" });
      } else {
        showToast(res?.message || "Gagal menghapus penilaian", "error");
      }
    } catch (error) {
      console.error(error);
      showToast("Gagal menghapus penilaian", "error");
    } finally {
      setDeleting(null);
    }
  };

  const getGradeColor = (score: number) => {
    if (score >= 80) return "#10b981";
    if (score >= 60) return "#f59e0b";
    if (score >= 40) return "#f97316";
    return "#ef4444";
  };

  const getGrade = (score: number) => {
    if (score >= 90) return "A+";
    if (score >= 80) return "A";
    if (score >= 70) return "B";
    if (score >= 60) return "C";
    if (score >= 50) return "D";
    return "E";
  };

  return (
    <>
      <div className="page-header">
        <h1>Manajemen Penilaian</h1>
        <p>Kelola penilaian yang sudah difinalisasi (Superadmin)</p>
      </div>

      <div className="manajemen-filter">
        <div className="filter-group">
          <label>Bulan</label>
          <select
            value={bulan}
            onChange={(e) => setBulan(parseInt(e.target.value))}
          >
            {MONTHS.map((m, i) => (
              <option key={i} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Tahun</label>
          <select
            value={tahun}
            onChange={(e) => setTahun(parseInt(e.target.value))}
          >
            {[2024, 2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="manajemen-card">
        <div className="card-header">
          <h2>Penilaian yang Difinalisasi</h2>
          <span className="badge">{evaluations.length} item</span>
        </div>

        {loading ? (
          <div className="loading-state">
            <p>Memuat data...</p>
          </div>
        ) : evaluations.length === 0 ? (
          <div className="empty-state">
            <p>
              Tidak ada penilaian yang difinalisasi pada bulan{" "}
              {MONTHS[bulan - 1]} {tahun}
            </p>
          </div>
        ) : (
          <div className="table-container">
            <table className="manajemen-table">
              <thead>
                <tr>
                  <th>No</th>
                  <th>Nama Peserta</th>
                  <th>Institusi</th>
                  <th>Kuantitas</th>
                  <th>Kualitas</th>
                  <th>Laporan</th>
                  <th>Nilai</th>
                  <th>Grade</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {evaluations.map((evaluation, idx) => {
                  const user =
                    typeof evaluation.userId === "string"
                      ? { name: evaluation.userId, instansi: "-" }
                      : evaluation.userId;
                  return (
                    <tr key={evaluation._id}>
                      <td>{idx + 1}</td>
                      <td className="cell-name">
                        {(user as any)?.name || "-"}
                      </td>
                      <td>{(user as any)?.instansi || "-"}</td>
                      <td className="cell-center">{evaluation.kuantitas}</td>
                      <td className="cell-center">{evaluation.kualitas}</td>
                      <td className="cell-center">
                        <span
                          className="badge-sm"
                          style={{
                            background: evaluation.laporan
                              ? "#10b98133"
                              : "#ef444733",
                            color: evaluation.laporan ? "#10b981" : "#ef4444",
                          }}
                        >
                          {evaluation.laporan ? "✓ Ada" : "✗ Tidak"}
                        </span>
                      </td>
                      <td className="cell-center">
                        <strong
                          style={{ color: getGradeColor(evaluation.hasil) }}
                        >
                          {evaluation.hasil}%
                        </strong>
                      </td>
                      <td className="cell-center">
                        <span
                          className="grade-badge"
                          style={{
                            background: getGradeColor(evaluation.hasil),
                          }}
                        >
                          {getGrade(evaluation.hasil)}
                        </span>
                      </td>
                      <td className="cell-center">
                        <button
                          className="btn-delete"
                          onClick={() =>
                            handleDeleteClick(
                              evaluation._id,
                              (user as any)?.name || "Unknown",
                            )
                          }
                          disabled={deleting === evaluation._id}
                          title="Hapus penilaian (reset ke Draft)"
                        >
                          {deleting === eval._id ? (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              style={{ animation: "spin 1s linear infinite" }}
                            >
                              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
                            </svg>
                          ) : (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <polyline points="3 6 5 6 21 6"></polyline>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"></path>
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

      {/* Confirmation Modal */}
      {confirmModal.show && (
        <div
          className="modal-overlay"
          onClick={() => setConfirmModal({ ...confirmModal, show: false })}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header danger">
              <h3>Hapus Penilaian</h3>
            </div>
            <div className="modal-body">
              <p>
                Anda yakin ingin menghapus penilaian{" "}
                <strong>{confirmModal.userName}</strong>?
              </p>
              <p className="text-muted">
                Penilaian akan direset ke status Draft dan Admin dapat membuat
                penilaian baru.
              </p>
            </div>
            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() =>
                  setConfirmModal({ ...confirmModal, show: false })
                }
                disabled={deleting !== null}
              >
                Batal
              </button>
              <button
                className="btn-danger"
                onClick={handleConfirmDelete}
                disabled={deleting !== null}
              >
                {deleting ? "Menghapus..." : "Hapus Penilaian"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ManajemenPenilaian;
