import React, { useState, useEffect, useCallback } from "react";
import { TargetSectionAPI } from "../../services/api";
import { useToast } from "../../context/ToastContext";
import type { TargetSection as TargetSectionType } from "../../types";
import "./TargetSection.css";

const DEFAULT_JOB_TYPES = [
  "Sortir",
  "Register",
  "Pencopotan Steples",
  "Scanning",
  "Rekardus",
  "Stikering",
];

const formatRupiah = (value: number): string => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

const TargetSection: React.FC = () => {
  const { showToast } = useToast();
  const [targets, setTargets] = useState<
    { jenis: string; targetPerDay: number }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Upah Harian state
  const [upahHarian, setUpahHarian] = useState(0);
  const [isEditingUpah, setIsEditingUpah] = useState(false);
  const [tempUpah, setTempUpah] = useState("");
  const [savingUpah, setSavingUpah] = useState(false);

  const loadTargets = useCallback(async () => {
    setLoading(true);
    const res = await TargetSectionAPI.getAll();
    if (res && res.success) {
      const existing = res.data || [];
      const merged = DEFAULT_JOB_TYPES.map((jenis) => {
        const found = existing.find(
          (t: TargetSectionType) => t.jenis === jenis,
        );
        return { jenis, targetPerDay: found ? found.targetPerDay : 0 };
      });
      setTargets(merged);
    } else {
      setTargets(
        DEFAULT_JOB_TYPES.map((jenis) => ({ jenis, targetPerDay: 0 })),
      );
    }
    setLoading(false);
  }, []);

  const loadUpahHarian = useCallback(async () => {
    const res = await TargetSectionAPI.getUpahHarian();
    if (res && res.success) {
      setUpahHarian(res.data.upahHarian || 0);
    }
  }, []);

  useEffect(() => {
    loadTargets();
    loadUpahHarian();
  }, [loadTargets, loadUpahHarian]);

  const handleChange = (index: number, value: number) => {
    setTargets((prev) =>
      prev.map((t, i) => (i === index ? { ...t, targetPerDay: value } : t)),
    );
  };

  const handleSave = async () => {
    setSaving(true);
    const res = await TargetSectionAPI.bulkUpdate(targets);
    if (res && res.success) {
      showToast("Target berhasil disimpan!", "success");
    } else {
      showToast(res?.message || "Gagal menyimpan target", "error");
    }
    setSaving(false);
  };

  const handleEditUpah = () => {
    setTempUpah(upahHarian.toString());
    setIsEditingUpah(true);
  };

  const handleSaveUpah = async () => {
    const value = parseFloat(tempUpah);
    if (isNaN(value) || value < 0) {
      showToast("Masukkan nilai upah yang valid", "error");
      return;
    }
    setSavingUpah(true);
    const res = await TargetSectionAPI.setUpahHarian(value);
    if (res && res.success) {
      setUpahHarian(value);
      setIsEditingUpah(false);
      showToast("Upah harian berhasil disimpan!", "success");
    } else {
      showToast(res?.message || "Gagal menyimpan upah harian", "error");
    }
    setSavingUpah(false);
  };

  const handleCancelUpah = () => {
    setIsEditingUpah(false);
    setTempUpah("");
  };

  if (loading) {
    return (
      <div className="target-section-page">
        <div className="page-loading">Memuat data target...</div>
      </div>
    );
  }

  return (
    <div className="target-section-page">
      {/* Header + Upah Harian Card Grid */}
      <div className="target-header-grid">
        <div className="page-header-target">
          <div className="page-header-content">
            <div className="page-icon">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="6" />
                <circle cx="12" cy="12" r="2" />
              </svg>
            </div>
            <div>
              <h1>Target Section</h1>
              <p>
                Atur target harian per jenis pekerjaan (global untuk semua
                peserta)
              </p>
            </div>
          </div>
        </div>

        {/* Upah Harian Card */}
        <div className="upah-harian-card">
          <div className="upah-harian-header">
            <div className="upah-icon">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
            <h3>Upah Harian</h3>
          </div>
          {!isEditingUpah ? (
            <div className="upah-display">
              <div className="upah-value">{formatRupiah(upahHarian)}</div>
              <button className="upah-edit-btn" onClick={handleEditUpah}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Edit
              </button>
            </div>
          ) : (
            <div className="upah-edit-form">
              <div className="upah-input-wrap">
                <span className="upah-prefix">Rp</span>
                <input
                  type="number"
                  value={tempUpah}
                  onChange={(e) => setTempUpah(e.target.value)}
                  placeholder="0"
                  min="0"
                  step="0.01"
                  className="upah-input"
                  autoFocus
                />
              </div>
              <div className="upah-edit-actions">
                <button className="upah-save-btn" onClick={handleSaveUpah} disabled={savingUpah}>
                  {savingUpah ? "..." : "Simpan"}
                </button>
                <button className="upah-cancel-btn" onClick={handleCancelUpah}>
                  Batal
                </button>
              </div>
            </div>
          )}
          <p className="upah-hint">Nilai upah harian per peserta magang</p>
        </div>
      </div>

      {/* Target Table Card */}
      <div className="target-card">
        <div className="target-card-header">
          <h2>Target Harian Per Jobdesk</h2>
          <p>
            Target berupa jumlah total (berkas + buku + bundle) yang harus
            diselesaikan per hari. Biaya per berkas dihitung otomatis dari Upah Harian / Target.
          </p>
        </div>
        <div className="target-table-wrap">
          <table className="target-table">
            <thead>
              <tr>
                <th className="th-no">No</th>
                <th className="th-jenis">Jenis Pekerjaan</th>
                <th className="th-target">Target</th>
                <th className="th-biaya">Biaya Per Berkas</th>
              </tr>
            </thead>
            <tbody>
              {targets.map((t, i) => {
                const biaya = t.targetPerDay > 0 ? upahHarian / t.targetPerDay : 0;
                return (
                  <tr key={t.jenis}>
                    <td className="td-no">{i + 1}</td>
                    <td className="td-jenis">{t.jenis}</td>
                    <td className="td-target">
                      <input
                        type="number"
                        min="0"
                        value={t.targetPerDay}
                        onChange={(e) =>
                          handleChange(
                            i,
                            Math.max(0, parseInt(e.target.value) || 0),
                          )
                        }
                        className="target-input"
                      />
                    </td>
                    <td className="td-biaya">
                      {t.targetPerDay > 0 ? (
                        <span className="biaya-value">{formatRupiah(biaya)}</span>
                      ) : (
                        <span className="biaya-empty">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="target-card-footer">
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Menyimpan..." : "Simpan Target"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TargetSection;
