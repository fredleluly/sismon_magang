import React, { useState, useEffect, useCallback } from 'react';
import { PerformanceAPI } from '../../services/api';
import type { PerformanceEvaluation, User } from '../../types';
import MonthYearSelector from '../../components/MonthYearSelector';
import { exportExcel } from '../../utils/excelExport';
import './Ranking.css';

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const Ranking: React.FC = () => {
  const now = new Date();
  const [bulan, setBulan] = useState(now.getMonth() + 1);
  const [tahun, setTahun] = useState(now.getFullYear());
  const [rankings, setRankings] = useState<PerformanceEvaluation[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRankings = useCallback(async () => {
    setLoading(true);
    const res = await PerformanceAPI.getRanking(bulan, tahun);
    if (res && res.success) setRankings(res.data || []);
    else setRankings([]);
    setLoading(false);
  }, [bulan, tahun]);

  useEffect(() => {
    loadRankings();
  }, [loadRankings]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#10b981';
    if (score >= 60) return '#f59e0b';
    if (score >= 40) return '#f97316';
    return '#ef4444';
  };

  const getMedalEmoji = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  const getGrade = (score: number) => {
    if (score >= 90) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    if (score >= 50) return 'D';
    return 'E';
  };

  const handleExportExcel = async () => {
    if (rankings.length === 0) {
      alert('Tidak ada data untuk diekspor');
      return;
    }

    const dataRows = rankings.map((ev, i) => {
      const user = ev.userId as User;
      return {
        no: i + 1,
        nama: user?.name || '-',
        absen: ev.absen,
        kuantitas: ev.kuantitas,
        kualitas: ev.kualitas,
        laporan: ev.laporan ? 5 : 0,
        hasil: ev.hasil,
        grade: getGrade(ev.hasil),
      };
    });

    const monthName = MONTHS[bulan - 1];

    await exportExcel({
      fileName: `Ranking_Performa_${monthName}_${tahun}`,
      companyName: 'PLN ICON+',
      sheets: [
        {
          sheetName: 'Ranking',
          title: 'RANKING PERFORMA PESERTA MAGANG',
          subtitle: `Periode: ${monthName} ${tahun}`,
          columns: [
            { header: 'Rank', key: 'no', width: 8, type: 'number' },
            { header: 'Nama Peserta', key: 'nama', width: 35 },
            { header: 'Absen (%)', key: 'absen', width: 15, type: 'number' },
            { header: 'Kuantitas (%)', key: 'kuantitas', width: 15, type: 'number' },
            { header: 'Kualitas (%)', key: 'kualitas', width: 15, type: 'number' },
            { header: 'Laporan (%)', key: 'laporan', width: 15, type: 'number' },
            { header: 'Hasil Akhir (%)', key: 'hasil', width: 18, type: 'number' },
            { header: 'Grade', key: 'grade', width: 12 },
          ],
          data: dataRows,
        },
      ],
    });
  };

  return (
    <div className="ranking-page">
      <div className="page-header-rank">
        <div className="page-header-content">
          <div className="page-icon-rank">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
              <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
              <path d="M4 22h16" />
              <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
              <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
              <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
            </svg>
          </div>
          <div>
            <h1>Ranking Performa</h1>
            <p>Peringkat peserta berdasarkan hasil evaluasi performa yang telah difinalisasi</p>
          </div>
        </div>
      </div>

      {/* Filter */}
      <MonthYearSelector bulan={bulan} tahun={tahun} onBulanChange={setBulan} onTahunChange={setTahun} />

      {loading ? (
        <div className="rank-loading">Memuat ranking...</div>
      ) : rankings.length === 0 ? (
        <div className="rank-empty-card">
          <div className="rank-empty-icon">🏆</div>
          <h3>Belum Ada Ranking</h3>
          <p>
            Belum ada penilaian yang difinalisasi untuk {MONTHS[bulan - 1]} {tahun}.
          </p>
        </div>
      ) : (
        <>
          {/* Top 3 Podium */}
          {rankings.length >= 1 && (
            <div className="podium-section">
              {rankings.length >= 2 && (
                <div className="podium-card podium-2">
                  <div className="podium-medal">🥈</div>
                  <div className="podium-name truncate-text" title={(rankings[1].userId as User)?.name || '-'}>{(rankings[1].userId as User)?.name || '-'}</div>
                  <div className="podium-score" style={{ color: getScoreColor(rankings[1].hasil) }}>
                    {rankings[1].hasil}%
                  </div>
                  <div className="podium-grade">{getGrade(rankings[1].hasil)}</div>
                </div>
              )}
              <div className="podium-card podium-1">
                <div className="podium-medal">🥇</div>
                <div className="podium-name truncate-text" title={(rankings[0].userId as User)?.name || '-'}>{(rankings[0].userId as User)?.name || '-'}</div>
                <div className="podium-score" style={{ color: getScoreColor(rankings[0].hasil) }}>
                  {rankings[0].hasil}%
                </div>
                <div className="podium-grade">{getGrade(rankings[0].hasil)}</div>
              </div>
              {rankings.length >= 3 && (
                <div className="podium-card podium-3">
                  <div className="podium-medal">🥉</div>
                  <div className="podium-name truncate-text" title={(rankings[2].userId as User)?.name || '-'}>{(rankings[2].userId as User)?.name || '-'}</div>
                  <div className="podium-score" style={{ color: getScoreColor(rankings[2].hasil) }}>
                    {rankings[2].hasil}%
                  </div>
                  <div className="podium-grade">{getGrade(rankings[2].hasil)}</div>
                </div>
              )}
            </div>
          )}

          {/* Full List */}
          <div className="rank-card">
            <div className="rank-card-header">
              <h2>
                Daftar Lengkap — {MONTHS[bulan - 1]} {tahun}
              </h2>
              <div className="flex items-center gap-3">
                <span className="rank-count">{rankings.length} peserta</span>
                <button className="btn-export" onClick={handleExportExcel} disabled={rankings.length === 0} title="Ekspor ke Excel">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                  Ekspor Excel
                </button>
              </div>
            </div>
            <div className="rank-table-wrap max-h-[500px] overflow-y-auto">
              <table className="rank-table">
                <thead className="sticky top-0 z-[1] bg-white">
                  <tr>
                    <th className="th-rank">Rank</th>
                    <th>Nama</th>

                    <th>Absen</th>
                    <th>Kuantitas</th>
                    <th>Kualitas</th>
                    <th>Laporan</th>
                    <th>Hasil</th>
                    <th>Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {rankings.map((ev, i) => {
                    const user = ev.userId as User;
                    return (
                      <tr key={ev._id} className={i < 3 ? `top-${i + 1}` : ''}>
                        <td className="td-rank">{getMedalEmoji(i + 1)}</td>
                        <td className="td-rank-name"><div className="truncate-text" title={user?.name || '-'}>{user?.name || '-'}</div></td>

                        <td>{ev.absen}%</td>
                        <td>{ev.kuantitas}%</td>
                        <td>{ev.kualitas}%</td>
                        <td>{ev.laporan ? '5%' : '0%'}</td>
                        <td>
                          <span className="rank-hasil" style={{ color: getScoreColor(ev.hasil) }}>
                            {ev.hasil}%
                          </span>
                        </td>
                        <td>
                          <span className={`grade-badge grade-${getGrade(ev.hasil).replace('+', 'plus')}`}>{getGrade(ev.hasil)}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Ranking;
