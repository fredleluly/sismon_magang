import React, { useState, useEffect, useCallback } from 'react';
import { TargetSectionAPI } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import type { TargetSection as TargetSectionType } from '../../types';
import './TargetSection.css';

const DEFAULT_JOB_TYPES = [
  'Sortir',
  'Register',
  'Pencopotan Steples',
  'Scanning',
  'Rekardus',
  'Stikering',
];

const TargetSection: React.FC = () => {
  const { showToast } = useToast();
  const [targets, setTargets] = useState<{ jenis: string; targetPerDay: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadTargets = useCallback(async () => {
    setLoading(true);
    const res = await TargetSectionAPI.getAll();
    if (res && res.success) {
      const existing = res.data || [];
      // Merge with defaults
      const merged = DEFAULT_JOB_TYPES.map(jenis => {
        const found = existing.find((t: TargetSectionType) => t.jenis === jenis);
        return { jenis, targetPerDay: found ? found.targetPerDay : 0 };
      });
      setTargets(merged);
    } else {
      setTargets(DEFAULT_JOB_TYPES.map(jenis => ({ jenis, targetPerDay: 0 })));
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadTargets(); }, [loadTargets]);

  const handleChange = (index: number, value: number) => {
    setTargets(prev => prev.map((t, i) => i === index ? { ...t, targetPerDay: value } : t));
  };

  const handleSave = async () => {
    setSaving(true);
    const res = await TargetSectionAPI.bulkUpdate(targets);
    if (res && res.success) {
      showToast('Target berhasil disimpan!', 'success');
    } else {
      showToast(res?.message || 'Gagal menyimpan target', 'error');
    }
    setSaving(false);
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
      <div className="page-header">
        <div className="page-header-content">
          <div className="page-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="6" />
              <circle cx="12" cy="12" r="2" />
            </svg>
          </div>
          <div>
            <h1>Target Section</h1>
            <p>Atur target harian per jenis pekerjaan (global untuk semua peserta)</p>
          </div>
        </div>
      </div>

      <div className="target-card">
        <div className="target-card-header">
          <h2>Target Harian Per Jobdesk</h2>
          <p>Target berupa jumlah total (berkas + buku + bundle) yang harus diselesaikan per hari.</p>
        </div>
        <div className="target-table-wrap">
          <table className="target-table">
            <thead>
              <tr>
                <th className="th-no">No</th>
                <th className="th-jenis">Jenis Pekerjaan</th>
                <th className="th-target">Target Per Hari</th>
              </tr>
            </thead>
            <tbody>
              {targets.map((t, i) => (
                <tr key={t.jenis}>
                  <td className="td-no">{i + 1}</td>
                  <td className="td-jenis">{t.jenis}</td>
                  <td className="td-target">
                    <input
                      type="number"
                      min="0"
                      value={t.targetPerDay}
                      onChange={(e) => handleChange(i, Math.max(0, parseInt(e.target.value) || 0))}
                      className="target-input"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="target-card-footer">
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Menyimpan...' : 'Simpan Target'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TargetSection;
