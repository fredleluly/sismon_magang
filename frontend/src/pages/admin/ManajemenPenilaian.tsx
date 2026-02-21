import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { PerformanceAPI } from "../../services/api";
import { useToast } from "../../context/ToastContext";
import type { PerformanceEvaluation, User } from "../../types";
import MonthYearSelector from "../../components/MonthYearSelector";
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
    console.log("handleDeleteClick", evalId, userName);
    // ensure state update happens even if called from nested handlers
    setConfirmModal((prev) => ({
      ...prev,
      show: true,
      evaluationId: evalId,
      userName,
    }));
  };

  // Immediate delete (fallback) - prompts with window.confirm then resets to Draft
  const handleDeleteImmediate = async (evalId: string, userName: string) => {
    const ok = window.confirm(
      `Hapus penilaian ${userName}? Ini akan mereset menjadi Draft.`,
    );
    if (!ok) return;
    setDeleting(evalId);
    try {
      const res = await PerformanceAPI.resetToDraft(evalId);
      if (res && res.success) {
        showToast("Penilaian berhasil direset ke Draft", "success");
        setEvaluations((prev) => prev.filter((e) => e._id !== evalId));
      } else {
        showToast(res?.message || "Gagal mereset penilaian", "error");
      }
    } catch (error) {
      console.error(error);
      showToast("Gagal mereset penilaian", "error");
    } finally {
      setDeleting(null);
    }
  };

  const handleConfirmDelete = async () => {
    const evalId = confirmModal.evaluationId;
    setDeleting(evalId);

    try {
      const res = await PerformanceAPI.resetToDraft(evalId);

      if (res && res.success) {
        showToast("Penilaian berhasil direset ke Draft", "success");
        setEvaluations((prev) => prev.filter((e) => e._id !== evalId));
        setConfirmModal({ show: false, evaluationId: "", userName: "" });
      } else {
        showToast(res?.message || "Gagal mereset penilaian", "error");
      }
    } catch (error) {
      console.error(error);
      showToast("Gagal mereset penilaian", "error");
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

      <MonthYearSelector
        bulan={bulan}
        tahun={tahun}
        onBulanChange={setBulan}
        onTahunChange={setTahun}
      />

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
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const evalId = evaluation._id;
                            const userName = (user as any)?.name || "Unknown";
                            console.log("DELETE CLICKED", evalId, userName);
                            handleDeleteClick(evalId, userName);
                          }}
                          disabled={deleting === evaluation._id}
                          title="Hapus penilaian (reset ke Draft)"
                          style={{ position: 'relative', zIndex: 100 }}
                        >
                          {deleting === evaluation._id ? (
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

      {createPortal(
        <div
          className={`modal-overlay ${confirmModal.show ? 'active' : ''}`}
          onClick={() => setConfirmModal({ ...confirmModal, show: false })}
        >
          <div
            className="modal-content reset-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-body-inner">
              <div className="modal-icon-wrapper">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#f97316"
                  strokeWidth="1.5"
                >
                  <path d="M3 6h18"></path>
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                  <path d="M10 11v6"></path>
                  <path d="M14 11v6"></path>
                  <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"></path>
                </svg>
              </div>
              <div className="modal-text-content">
                <h3 className="modal-title">Reset Penilaian ke Draft</h3>
                <p className="modal-text">
                  Anda yakin ingin mereset penilaian
                  <strong style={{ marginLeft: 6 }}>
                    {confirmModal.userName}
                  </strong>
                  ?
                </p>
                <p className="modal-subtext">
                  Tindakan ini akan mereset penilaian menjadi{" "}
                  <strong>Draft</strong>.
                </p>
              </div>
            </div>

            <div className="modal-actions">
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
                {deleting ? "Menghapus..." : "Reset ke Draft"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default ManajemenPenilaian;
