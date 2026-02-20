import React, { useEffect, useState, useRef } from "react";
import { Chart, registerables } from "chart.js";
// ExcelJS and file-saver are dynamically imported in exportToExcel
import {
  DashboardAPI,
  getToken,
  ComplaintAPI,
  PerformanceAPI,
} from "../../services/api";
import { useToast } from "../../context/ToastContext";
import type {
  AdminDashboard as AdminDashData,
  PerformanceEvaluation,
  User,
} from "../../types";
import "./Ranking.css";

Chart.register(...registerables);

function animateCounter(el: HTMLElement | null, target: number, suffix = "") {
  if (!el) return;
  const duration = 1200;
  const startTime = performance.now();
  function tick(now: number) {
    const p = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el!.textContent = Math.round(target * eased).toLocaleString() + suffix;
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function getTimeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Baru saja";
  if (mins < 60) return mins + " menit lalu";
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours + " jam lalu";
  return Math.floor(hours / 24) + " hari lalu";
}

const AdminDashboard: React.FC = () => {
  const { showToast } = useToast();
  const [data, setData] = useState<AdminDashData | null>(null);
  const [attendanceList, setAttendanceList] = useState<any[]>([]);
  const [totalComplaints, setTotalComplaints] = useState(0);
  const [rankings, setRankings] = useState<PerformanceEvaluation[]>([]);
  const weeklyRef = useRef<HTMLCanvasElement>(null);
  const donutRef = useRef<HTMLCanvasElement>(null);
  const charts = useRef<Chart[]>([]);

  // Filter States
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filterType, setFilterType] = useState<"bulanan" | "custom">("bulanan");
  const [dateRangeStart, setDateRangeStart] = useState<string>("");
  const [dateRangeEnd, setDateRangeEnd] = useState<string>("");
  const [isSelectingDateRange, setIsSelectingDateRange] = useState(false);
  const [datePickerMonth, setDatePickerMonth] = useState(new Date());
  const [isSelectingStart, setIsSelectingStart] = useState(true);

  // Helper to get date string YYYY-MM-DD
  const toDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const loadDashboardData = async () => {
    let q = "";
    if (filterType === "bulanan") {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 0);
      q = `?startDate=${toDateString(start)}&endDate=${toDateString(end)}`;
    } else if (filterType === "custom" && dateRangeStart && dateRangeEnd) {
      q = `?startDate=${dateRangeStart}&endDate=${dateRangeEnd}`;
    }

    DashboardAPI.getAdmin(q).then((res) => {
      if (res && res.success) setData(res.data);
      else showToast("Gagal memuat dashboard", "error");
    });
  };

  useEffect(() => {
    loadDashboardData();
  }, [filterType, currentDate, dateRangeStart, dateRangeEnd]);

  useEffect(() => {
    // Load total complaints
    loadComplaints();
    loadRankings();

    loadAttendance();
    const iv = setInterval(loadAttendance, 15000);
    return () => {
      clearInterval(iv);
      charts.current.forEach((c) => c.destroy());
    };
  }, []);

  const handleFilterChange = (type: "bulanan" | "custom") => {
    setFilterType(type);
    if (type === "bulanan") setCurrentDate(new Date());
  };

  const handlePrevMonth = () =>
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() - 1),
    );
  const handleNextMonth = () =>
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() + 1),
    );

  const loadComplaints = async () => {
    try {
      const res = await ComplaintAPI.getAll();
      if (res && res.success) {
        setTotalComplaints((res.data || []).length);
      }
    } catch {
      console.error("Failed to load complaints");
    }
  };

  const loadRankings = async () => {
    const now = new Date();
    const res = await PerformanceAPI.getRanking(
      now.getMonth() + 1,
      now.getFullYear(),
    );
    if (res && res.success) setRankings((res.data || []).slice(0, 3));
  };

  const getScoreColor = (score: number) => {
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

  const loadAttendance = async () => {
    try {
      const res = await fetch("/api/attendance/today", {
        headers: { Authorization: "Bearer " + getToken() },
      });
      const d = await res.json();
      if (d.success) setAttendanceList(d.data || []);
    } catch { }
  };

  const exportToExcel = async () => {
    if (!data) {
      showToast("Data tidak tersedia", "error");
      return;
    }

    try {
      const ExcelJS = (await import("exceljs")).default;
      const { saveAs } = await import("file-saver");

      const wb = new ExcelJS.Workbook();
      wb.creator = "Admin Dashboard";
      wb.created = new Date();

      const todayStr = new Date().toLocaleDateString("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });

      // ── Theme constants ──
      const T = {
        titleBg: "0D2137",
        titleFont: "FFFFFF",
        subtitleBg: "2E86C1",
        subtitleFont: "FFFFFF",
        infoBg: "D6EAF8",
        infoFont: "1B4F72",
        headerBg: "1B4F72",
        headerFont: "FFFFFF",
        zebraLight: "F8FBFD",
        zebraDark: "EBF5FB",
        summaryBg: "D4E6F1",
        summaryFont: "0D2137",
        border: "B0C4DE",
        bodyFont: "2C3E50",
      };

      const thin = (c = T.border) => ({
        top: { style: "thin" as const, color: { argb: c } },
        left: { style: "thin" as const, color: { argb: c } },
        bottom: { style: "thin" as const, color: { argb: c } },
        right: { style: "thin" as const, color: { argb: c } },
      });

      const solidFill = (c: string) => ({
        type: "pattern" as const,
        pattern: "solid" as const,
        fgColor: { argb: c },
      });

      // ── Helper: add a professional styled sheet ──
      const addStyledSheet = (
        sheetName: string,
        title: string,
        subtitle: string,
        infoLines: string[],
        columns: { header: string; key: string; width: number; type?: string }[],
        rows: Record<string, any>[],
        summaryRow?: Record<string, any>,
      ) => {
        const ws = wb.addWorksheet(sheetName);
        const colCount = columns.length;
        let rowNum = 1;

        // Title row
        ws.mergeCells(rowNum, 1, rowNum, colCount);
        const titleCell = ws.getCell(rowNum, 1);
        titleCell.value = title;
        titleCell.font = { name: "Calibri", bold: true, size: 14, color: { argb: T.titleFont } };
        titleCell.fill = solidFill(T.titleBg);
        titleCell.alignment = { horizontal: "center", vertical: "middle" };
        ws.getRow(rowNum).height = 36;
        rowNum++;

        // Subtitle row
        if (subtitle) {
          ws.mergeCells(rowNum, 1, rowNum, colCount);
          const subCell = ws.getCell(rowNum, 1);
          subCell.value = subtitle;
          subCell.font = { name: "Calibri", italic: true, size: 11, color: { argb: T.subtitleFont } };
          subCell.fill = solidFill(T.subtitleBg);
          subCell.alignment = { horizontal: "center", vertical: "middle" };
          ws.getRow(rowNum).height = 24;
          rowNum++;
        }

        // Info lines
        for (const line of infoLines) {
          ws.mergeCells(rowNum, 1, rowNum, colCount);
          const infoCell = ws.getCell(rowNum, 1);
          infoCell.value = line;
          infoCell.font = { name: "Calibri", size: 10, color: { argb: T.infoFont } };
          infoCell.fill = solidFill(T.infoBg);
          infoCell.alignment = { horizontal: "left", vertical: "middle" };
          ws.getRow(rowNum).height = 20;
          rowNum++;
        }

        // Blank spacer
        rowNum++;

        // Header row
        const headerRow = ws.getRow(rowNum);
        columns.forEach((col, ci) => {
          const cell = headerRow.getCell(ci + 1);
          cell.value = col.header;
          cell.font = { name: "Calibri", bold: true, size: 11, color: { argb: T.headerFont } };
          cell.fill = solidFill(T.headerBg);
          cell.alignment = { horizontal: "center", vertical: "middle" };
          cell.border = thin();
        });
        headerRow.height = 28;
        rowNum++;

        // Data rows with zebra striping
        rows.forEach((row, ri) => {
          const r = ws.getRow(rowNum);
          const bgColor = ri % 2 === 0 ? T.zebraLight : T.zebraDark;
          columns.forEach((col, ci) => {
            const cell = r.getCell(ci + 1);
            cell.value = row[col.key] ?? "";
            cell.font = { name: "Calibri", size: 10, color: { argb: T.bodyFont } };
            cell.fill = solidFill(bgColor);
            cell.border = thin();
            cell.alignment = {
              horizontal: col.type === "number" ? "right" : "left",
              vertical: "middle",
            };
            if (col.type === "number" && typeof cell.value === "number") {
              cell.numFmt = "#,##0";
            }
          });
          r.height = 22;
          rowNum++;
        });

        // Summary row
        if (summaryRow) {
          const r = ws.getRow(rowNum);
          columns.forEach((col, ci) => {
            const cell = r.getCell(ci + 1);
            const val = summaryRow[col.key];
            cell.value = ci === 0 ? "TOTAL" : val ?? "";
            cell.font = { name: "Calibri", bold: true, size: 11, color: { argb: T.summaryFont } };
            cell.fill = solidFill(T.summaryBg);
            cell.border = thin();
            cell.alignment = {
              horizontal: col.type === "number" ? "right" : ci === 0 ? "center" : "left",
              vertical: "middle",
            };
            if (col.type === "number" && typeof cell.value === "number") {
              cell.numFmt = "#,##0";
            }
          });
          r.height = 26;
          rowNum++;
        }

        // Column widths
        columns.forEach((col, ci) => {
          ws.getColumn(ci + 1).width = col.width || 15;
        });

        return { ws, lastRow: rowNum };
      };

      // ═══════════════════════════════════════════════════════════════
      // Sheet 1: DASHBOARD OVERVIEW — Stat cards + embedded chart images
      // ═══════════════════════════════════════════════════════════════
      const regStats = (data as any).registerStats || { berkas: 0, buku: 0, bundle: 0 };
      const grandTotal = (regStats.berkas || 0) + (regStats.buku || 0) + (regStats.bundle || 0);

      const { ws: ws1, lastRow: lr1 } = addStyledSheet(
        "Dashboard",
        "DASHBOARD MONITORING",
        "Overview produktivitas dan kehadiran peserta magang",
        [`Tanggal Cetak: ${todayStr}`],
        [
          { header: "No", key: "no", width: 6, type: "number" },
          { header: "Indikator", key: "indikator", width: 35 },
          { header: "Nilai", key: "nilai", width: 18, type: "number" },
          { header: "Keterangan", key: "keterangan", width: 30 },
        ],
        [
          { no: 1, indikator: "Kehadiran Hari Ini", nilai: attendanceList.length, keterangan: `dari ${data.totalPeserta || 0} peserta` },
          { no: 2, indikator: "Total Sortir", nilai: data.totalSortir || 0, keterangan: "Item selesai" },
          { no: 3, indikator: "Total Pencopotan Steples", nilai: data.totalSteples || 0, keterangan: "Item selesai" },
          { no: 4, indikator: "Total Scanning", nilai: data.totalScanning || 0, keterangan: "Item selesai" },
          { no: 5, indikator: "Total Register", nilai: data.totalRegister || 0, keterangan: "Item selesai" },
          { no: 6, indikator: "Pencetakan Stiker", nilai: data.totalStikering || 0, keterangan: "Item selesai" },
          { no: 7, indikator: "Arsip Tersimpan (Rekardus)", nilai: data.totalRekardus || 0, keterangan: "Total item" },
          { no: 8, indikator: "Kategori Arsip — Berkas", nilai: regStats.berkas || 0, keterangan: "Total berkas" },
          { no: 9, indikator: "Kategori Arsip — Buku", nilai: regStats.buku || 0, keterangan: "Total buku" },
          { no: 10, indikator: "Kategori Arsip — Bundle", nilai: regStats.bundle || 0, keterangan: "Total bundle" },
          { no: 11, indikator: "Grand Total Kategori Arsip", nilai: grandTotal, keterangan: "Berkas + Buku + Bundle" },
        ],
      );

      // Embed chart images from canvas
      const chartStartRow = lr1 + 1;

      // Chart 1: Rekardus area chart
      if (weeklyRef.current) {
        try {
          const base64 = weeklyRef.current.toDataURL("image/png").split(",")[1];
          const imgId = wb.addImage({ base64, extension: "png" });
          // Label above chart
          ws1.mergeCells(chartStartRow, 1, chartStartRow, 4);
          const labelCell = ws1.getCell(chartStartRow, 1);
          labelCell.value = `📊 Arsip Tersimpan (Rekardus) — Total: ${(data.totalRekardus || 0).toLocaleString()} item`;
          labelCell.font = { name: "Calibri", bold: true, size: 12, color: { argb: T.titleBg } };
          labelCell.alignment = { horizontal: "left", vertical: "middle" };
          ws1.getRow(chartStartRow).height = 24;

          ws1.addImage(imgId, {
            tl: { col: 0.2, row: chartStartRow },
            ext: { width: 550, height: 280 },
          });
        } catch (e) {
          console.warn("Could not capture weekly chart:", e);
        }
      }

      // Chart 2: Donut chart
      const donutStartRow = chartStartRow + 16;
      if (donutRef.current) {
        try {
          const base64 = donutRef.current.toDataURL("image/png").split(",")[1];
          const imgId = wb.addImage({ base64, extension: "png" });
          ws1.mergeCells(donutStartRow, 1, donutStartRow, 4);
          const labelCell2 = ws1.getCell(donutStartRow, 1);
          labelCell2.value = `📊 Kategori Arsip — Berkas: ${regStats.berkas || 0} | Buku: ${regStats.buku || 0} | Bundle: ${regStats.bundle || 0}`;
          labelCell2.font = { name: "Calibri", bold: true, size: 12, color: { argb: T.titleBg } };
          labelCell2.alignment = { horizontal: "left", vertical: "middle" };
          ws1.getRow(donutStartRow).height = 24;

          ws1.addImage(imgId, {
            tl: { col: 0.2, row: donutStartRow },
            ext: { width: 400, height: 300 },
          });
        } catch (e) {
          console.warn("Could not capture donut chart:", e);
        }
      }

      // ═══════════════════════════════════════════════════════════════
      // Sheet 2: PROGRES MINGGUAN (Rekardus chart data)
      // ═══════════════════════════════════════════════════════════════
      if (data.weeklyProgress && data.weeklyProgress.length > 0) {
        const wp = data.weeklyProgress;
        const totalBerkas = wp.reduce((s, w) => s + (w.berkas || 0), 0);
        const totalBuku = wp.reduce((s, w) => s + (w.buku || 0), 0);
        const totalBundle = wp.reduce((s, w) => s + (w.bundle || 0), 0);

        addStyledSheet(
          "Progres Mingguan",
          "PROGRES PEKERJAAN MINGGUAN",
          "Tren penyelesaian tugas per kategori",
          [
            `Periode: ${wp.length} hari terakhir`,
            `Total: ${totalBerkas + totalBuku + totalBundle} item`,
          ],
          [
            { header: "No", key: "no", width: 6, type: "number" },
            { header: "Tanggal", key: "tanggal", width: 28 },
            { header: "Berkas", key: "berkas", width: 12, type: "number" },
            { header: "Buku", key: "buku", width: 12, type: "number" },
            { header: "Bundle", key: "bundle", width: 12, type: "number" },
            { header: "Total", key: "total", width: 12, type: "number" },
          ],
          wp.map((w, i) => ({
            no: i + 1,
            tanggal: new Date(w._id).toLocaleDateString("id-ID", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            }),
            berkas: w.berkas || 0,
            buku: w.buku || 0,
            bundle: w.bundle || 0,
            total: (w.berkas || 0) + (w.buku || 0) + (w.bundle || 0),
          })),
          {
            no: "",
            tanggal: "",
            berkas: totalBerkas,
            buku: totalBuku,
            bundle: totalBundle,
            total: totalBerkas + totalBuku + totalBundle,
          },
        );
      }

      // ═══════════════════════════════════════════════════════════════
      // Sheet 3: DISTRIBUSI TUGAS (donut chart data)
      // ═══════════════════════════════════════════════════════════════
      if (data.workDistribution && data.workDistribution.length > 0) {
        const wd = data.workDistribution;
        const totalCount = wd.reduce((s, w) => s + (w.count || 0), 0);

        addStyledSheet(
          "Distribusi Tugas",
          "DISTRIBUSI JENIS PEKERJAAN",
          "Sebaran tugas berdasarkan kategori",
          [
            `Total Jenis: ${wd.length} kategori`,
            `Total Pekerjaan: ${totalCount} item`,
          ],
          [
            { header: "No", key: "no", width: 6, type: "number" },
            { header: "Jenis Pekerjaan", key: "jenis", width: 30 },
            { header: "Jumlah", key: "jumlah", width: 14, type: "number" },
            { header: "Persentase", key: "persen", width: 14 },
          ],
          wd.map((w, i) => ({
            no: i + 1,
            jenis: w._id || "Lainnya",
            jumlah: w.count || 0,
            persen:
              totalCount > 0
                ? (((w.count || 0) / totalCount) * 100).toFixed(1) + "%"
                : "0%",
          })),
          { no: "", jenis: "", jumlah: totalCount, persen: "100%" },
        );
      }

      // ═══════════════════════════════════════════════════════════════
      // Sheet 4: TOP 3 PESERTA TERBAIK (matches podium on dashboard)
      // ═══════════════════════════════════════════════════════════════
      if (rankings.length > 0) {
        addStyledSheet(
          "Top Peserta",
          "🏆 TOP 3 PESERTA TERBAIK",
          "Berdasarkan penilaian performa bulan ini",
          [`Total: ${rankings.length} peserta`],
          [
            { header: "Peringkat", key: "rank", width: 12, type: "number" },
            { header: "Nama Peserta", key: "nama", width: 28 },
            { header: "Institusi", key: "instansi", width: 30 },
            { header: "Skor (%)", key: "skor", width: 12, type: "number" },
            { header: "Grade", key: "grade", width: 10 },
          ],
          rankings.map((r, i) => ({
            rank: i + 1,
            nama: (r.userId as User)?.name || "-",
            instansi: (r.userId as User)?.instansi || "-",
            skor: r.hasil || 0,
            grade: getGrade(r.hasil || 0),
          })),
        );
      }

      // ═══════════════════════════════════════════════════════════════
      // Sheet 5: KEHADIRAN HARI INI
      // ═══════════════════════════════════════════════════════════════
      if (attendanceList.length > 0) {
        const aktif = attendanceList.filter((r: any) => !r.jamKeluar).length;
        const keluar = attendanceList.filter((r: any) => r.jamKeluar).length;

        addStyledSheet(
          "Kehadiran Hari Ini",
          "📋 DAFTAR KEHADIRAN HARI INI",
          todayStr,
          [
            `Total Hadir: ${attendanceList.length} peserta`,
            `Aktif: ${aktif} | Sudah Keluar: ${keluar}`,
          ],
          [
            { header: "No", key: "no", width: 6, type: "number" },
            { header: "Nama Peserta", key: "nama", width: 28 },
            { header: "Institusi", key: "instansi", width: 30 },
            { header: "Jam Masuk", key: "jamMasuk", width: 14 },
            { header: "Jam Keluar", key: "jamKeluar", width: 14 },
            { header: "Status", key: "status", width: 14 },
          ],
          attendanceList.map((r: any, i: number) => ({
            no: i + 1,
            nama: r.userId?.name || "Unknown",
            instansi: r.userId?.instansi || "-",
            jamMasuk: r.jamMasuk || "-",
            jamKeluar: r.jamKeluar || "Belum Keluar",
            status: r.jamKeluar ? "Selesai" : "Aktif",
          })),
        );
      }

      // ═══════════════════════════════════════════════════════════════
      // Sheet 6: AKTIVITAS TERBARU
      // ═══════════════════════════════════════════════════════════════
      if (data.recentActivity && data.recentActivity.length > 0) {
        const ra = data.recentActivity;
        const totalB = ra.reduce((s: number, a: any) => s + (a.berkas || 0), 0);
        const totalK = ra.reduce((s: number, a: any) => s + (a.buku || 0), 0);
        const totalBd = ra.reduce(
          (s: number, a: any) => s + (a.bundle || 0),
          0,
        );

        addStyledSheet(
          "Aktivitas Terbaru",
          "AKTIVITAS PEKERJAAN TERBARU",
          "Update terkini dari peserta magang",
          [
            `Total: ${ra.length} aktivitas`,
            `Berkas: ${totalB} | Buku: ${totalK} | Bundle: ${totalBd}`,
          ],
          [
            { header: "No", key: "no", width: 6, type: "number" },
            { header: "Nama Peserta", key: "nama", width: 24 },
            { header: "Jenis Pekerjaan", key: "jenis", width: 22 },
            { header: "Berkas", key: "berkas", width: 10, type: "number" },
            { header: "Buku", key: "buku", width: 10, type: "number" },
            { header: "Bundle", key: "bundle", width: 10, type: "number" },
            { header: "Tanggal", key: "tanggal", width: 22 },
            { header: "Keterangan", key: "keterangan", width: 28 },
          ],
          ra.map((a: any, i: number) => ({
            no: i + 1,
            nama:
              typeof a.userId === "string"
                ? "Unknown"
                : a.userId?.name || "Unknown",
            jenis: a.jenis || "-",
            berkas: a.berkas || 0,
            buku: a.buku || 0,
            bundle: a.bundle || 0,
            tanggal: new Date(a.createdAt).toLocaleDateString("id-ID", {
              day: "numeric",
              month: "long",
              year: "numeric",
            }),
            keterangan: a.keterangan || "-",
          })),
          {
            no: "",
            nama: "",
            jenis: "",
            berkas: totalB,
            buku: totalK,
            bundle: totalBd,
            tanggal: "",
            keterangan: "",
          },
        );
      }

      // ── Save file ──
      const now = new Date();
      const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
      const buffer = await wb.xlsx.writeBuffer();
      saveAs(
        new Blob([buffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        `Dashboard_Monitoring_${stamp}.xlsx`,
      );
      showToast("Data berhasil diekspor ke Excel", "success");
    } catch (error) {
      console.error("Export error:", error);
      showToast("Gagal mengekspor data", "error");
    }
  };

  useEffect(() => {
    if (!data) return;
    charts.current.forEach((c) => c.destroy());
    charts.current = [];

    // Weekly chart (Rekardus Area Chart)
    if (weeklyRef.current) {
      const wp = data.weeklyProgress || [];
      const labels = wp.map((w) =>
        new Date(w._id).toLocaleDateString("id-ID", {
          weekday: "short",
          day: "numeric",
          month: "short",
        }),
      );
      // Backend now sends 'total' in weeklyProgress for Rekardus
      const datasetData = wp.map(
        (w) => (w as any).total || w.berkas + w.buku + w.bundle,
      );

      const c = new Chart(weeklyRef.current, {
        type: "line",
        data: {
          labels: labels.length ? labels : ["No data"],
          datasets: [
            {
              label: "Rekardus",
              data: datasetData,
              backgroundColor: "rgba(59, 130, 246, 0.2)", // Area fill color
              borderColor: "#3b82f6", // Line color
              borderWidth: 2,
              pointBackgroundColor: "#fff",
              pointBorderColor: "#3b82f6",
              pointRadius: 4,
              pointHoverRadius: 6,
              fill: true,
              tension: 0.3, // Smooth curve
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false,
            },
            tooltip: {
              backgroundColor: "#fff",
              titleColor: "#1e293b",
              bodyColor: "#64748b",
              borderColor: "#e2e8f0",
              borderWidth: 1,
              cornerRadius: 10,
              padding: 12,
              displayColors: false,
            },
          },
          scales: {
            x: { grid: { display: false }, ticks: { color: "#94a3b8" } },
            y: {
              grid: { color: "rgba(226,232,240,0.5)" },
              ticks: { color: "#94a3b8" },
              beginAtZero: true,
            },
          },
        },
      });
      charts.current.push(c);
    }

    // Donut chart — Register totals (berkas, buku, bundle)
    if (donutRef.current) {
      const regStats = (data as any).registerStats || {
        berkas: 0,
        buku: 0,
        bundle: 0,
      };
      const totalBerkas = regStats.berkas || 0;
      const totalBuku = regStats.buku || 0;
      const totalBundle = regStats.bundle || 0;
      const grandTotal = totalBerkas + totalBuku + totalBundle;
      const donutColors = ["#4db8e8", "#8b5cf6", "#22c55e"];
      const c = new Chart(donutRef.current, {
        type: "doughnut",
        data: {
          labels: ["Berkas", "Buku", "Bundle"],
          datasets: [
            {
              data: [totalBerkas, totalBuku, totalBundle],
              backgroundColor: donutColors,
              borderWidth: 3,
              borderColor: "#fff",
              hoverOffset: 8,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: "68%",
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: "#fff",
              titleColor: "#1e293b",
              bodyColor: "#64748b",
              borderColor: "#e2e8f0",
              borderWidth: 1,
              cornerRadius: 10,
              padding: 12,
            },
          },
        },
        plugins: [
          {
            id: "centerText",
            beforeDraw(chart) {
              const { ctx, width, height } = chart;
              ctx.save();
              ctx.font = "bold 28px sans-serif";
              ctx.fillStyle = "#1a1a2e";
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillText(
                grandTotal.toLocaleString(),
                width / 2,
                height / 2 - 8,
              );
              ctx.font = "12px sans-serif";
              ctx.fillStyle = "#94a3b8";
              ctx.fillText("Total Item", width / 2, height / 2 + 16);
              ctx.restore();
            },
          },
        ],
      });
      charts.current.push(c);
    }
  }, [data]);

  if (!data)
    return (
      <div className="text-center p-16 text-gray-400">
        Memuat dashboard...
      </div>
    );

  const ra = data.recentActivity || [];
  const donutLegendItems = [
    { label: "Berkas", color: "#4db8e8" },
    { label: "Buku", color: "#8b5cf6" },
    { label: "Bundle", color: "#22c55e" },
  ];

  return (
    <>
      <div className="page-header-row">
        <div className="page-header">
          <h1>Dashboard Monitoring</h1>
          <p>Overview produktivitas dan kehadiran peserta magang</p>
        </div>

        <div className="dashboard-filter-bar">
          {/* Filter UI */}
          <div className="dashboard-filter-group">
            <button
              onClick={() => handleFilterChange("bulanan")}
              className={`dashboard-filter-btn ${filterType === "bulanan" ? "active" : ""}`}
            >
              Bulanan
            </button>
            <button
              onClick={() => {
                handleFilterChange("custom");
                if (!isSelectingDateRange) setIsSelectingStart(true);
              }}
              className={`dashboard-filter-btn ${filterType === "custom" ? "active" : ""}`}
            >
              Custom
            </button>
          </div>

          <div className="dashboard-month-export-row">
            {filterType === "bulanan" ? (
              <div className="month-picker-container">
                <button onClick={handlePrevMonth} className="month-nav-btn">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="15 18 9 12 15 6"></polyline>
                  </svg>
                </button>
                <span className="month-display">
                  {currentDate.toLocaleDateString("id-ID", {
                    month: "long",
                    year: "numeric",
                  })}
                </span>
                <button onClick={handleNextMonth} className="month-nav-btn">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </button>
              </div>
            ) : (
              <div className="dashboard-custom-date">
                <button
                  onClick={() => setIsSelectingDateRange(!isSelectingDateRange)}
                  className="dashboard-custom-trigger"
                >
                  {dateRangeStart && dateRangeEnd
                    ? `${dateRangeStart} - ${dateRangeEnd}`
                    : "Pilih Tanggal"}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>

                {isSelectingDateRange && (
                  <div className="dashboard-date-popup">
                    <div className="mb-3">
                      <p className="text-xs text-gray-500 mb-1">
                        {isSelectingStart
                          ? "Pilih Tanggal Awal"
                          : "Pilih Tanggal Akhir"}
                      </p>
                      <div className="text-sm font-semibold">
                        {dateRangeStart || "-"} s/d {dateRangeEnd || "-"}
                      </div>
                    </div>

                    <div className="flex justify-between items-center mb-3">
                      <button
                        onClick={() =>
                          setDatePickerMonth(
                            new Date(
                              datePickerMonth.getFullYear(),
                              datePickerMonth.getMonth() - 1,
                            ),
                          )
                        }
                        className="p-1"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="15 18 9 12 15 6"></polyline>
                        </svg>
                      </button>
                      <span className="text-sm font-semibold">
                        {datePickerMonth.toLocaleDateString("id-ID", {
                          month: "long",
                          year: "numeric",
                        })}
                      </span>
                      <button
                        onClick={() =>
                          setDatePickerMonth(
                            new Date(
                              datePickerMonth.getFullYear(),
                              datePickerMonth.getMonth() + 1,
                            ),
                          )
                        }
                        className="p-1"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                      </button>
                    </div>

                    <div className="grid grid-cols-7 gap-0.5 mb-2">
                      {["M", "S", "S", "R", "K", "J", "S"].map((d) => (
                        <div
                          key={d}
                          className="text-[11px] text-center text-gray-400 p-1"
                        >
                          {d}
                        </div>
                      ))}
                      {Array.from({
                        length: new Date(
                          datePickerMonth.getFullYear(),
                          datePickerMonth.getMonth(),
                          1,
                        ).getDay(),
                      }).map((_, i) => (
                        <div key={`e-${i}`} />
                      ))}
                      {Array.from({
                        length: new Date(
                          datePickerMonth.getFullYear(),
                          datePickerMonth.getMonth() + 1,
                          0,
                        ).getDate(),
                      }).map((_, i) => {
                        const d = i + 1;
                        const dateStr = `${datePickerMonth.getFullYear()}-${String(datePickerMonth.getMonth() + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                        const isSelected =
                          dateStr === dateRangeStart ||
                          dateStr === dateRangeEnd;
                        const inRange =
                          dateRangeStart &&
                          dateRangeEnd &&
                          dateStr > dateRangeStart &&
                          dateStr < dateRangeEnd;

                        return (
                          <div
                            key={d}
                            onClick={() => {
                              if (isSelectingStart) {
                                setDateRangeStart(dateStr);
                                setDateRangeEnd("");
                                setIsSelectingStart(false);
                              } else {
                                if (dateStr >= dateRangeStart) {
                                  setDateRangeEnd(dateStr);
                                  setIsSelectingDateRange(false);
                                  setIsSelectingStart(true);
                                } else {
                                  showToast(
                                    "Tanggal akhir harus lebih besar",
                                    "error",
                                  );
                                }
                              }
                            }}
                            className={`p-1.5 text-center text-[13px] cursor-pointer rounded ${isSelected
                              ? 'bg-primary-500 text-white'
                              : inRange
                                ? 'bg-primary-50'
                                : 'hover:bg-gray-100'
                              }`}
                          >
                            {d}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              className="btn-export"
              onClick={exportToExcel}
              title="Ekspor ke Excel"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Ekspor Excel
            </button>
          </div>
        </div>
      </div>
      <div className="admin-stats-grid">
        <div className="admin-stat-card">
          <div className="stat-info">
            <div className="stat-label">Kehadiran Hari Ini</div>
            <div
              className="stat-value"
              ref={(el) =>
                el &&
                attendanceList &&
                animateCounter(el, attendanceList.length)
              }
            >
              0
            </div>
            <div className="stat-change">
              dari {data?.totalPeserta || 0} peserta
            </div>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-info">
            <div className="stat-label">Total Sortir</div>
            <div
              className="stat-value"
              ref={(el) =>
                el && data && animateCounter(el, data.totalSortir || 0)
              }
            >
              0
            </div>
            <div className="stat-change">Item selesai</div>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-info">
            <div className="stat-label">Total Pencopotan Steples</div>
            <div
              className="stat-value"
              ref={(el) =>
                el && data && animateCounter(el, data.totalSteples || 0)
              }
            >
              0
            </div>
            <div className="stat-change">Item selesai</div>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-info">
            <div className="stat-label">Total Scanning</div>
            <div
              className="stat-value"
              ref={(el) =>
                el && data && animateCounter(el, data.totalScanning || 0)
              }
            >
              0
            </div>
            <div className="stat-change">Item selesai</div>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-info">
            <div className="stat-label">Total Register</div>
            <div
              className="stat-value"
              ref={(el) =>
                el && data && animateCounter(el, data.totalRegister || 0)
              }
            >
              0
            </div>
            <div className="stat-change">Item selesai</div>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-info">
            <div className="stat-label">Pencetakan Stiker</div>
            <div
              className="stat-value"
              ref={(el) =>
                el && data && animateCounter(el, data.totalStikering || 0)
              }
            >
              0
            </div>
            <div className="stat-change">Item selesai</div>
          </div>
        </div>
      </div>

      <div className="charts-row">
        <div className="chart-card">
          <div className="chart-header">
            <h3>Arsip Tersimpan (rekardus)</h3>
            <p>
              Total Rekardus:{" "}
              <strong>{(data.totalRekardus || 0).toLocaleString()}</strong> item
            </p>
          </div>
          <div className="chart-canvas-wrapper">
            <canvas ref={weeklyRef} />
          </div>
        </div>
        <div className="chart-card">
          <div className="chart-header">
            <h3>Kategori Arsip</h3>
            <p>Total tiap kategori berkas, buku, dan bundle</p>
          </div>
          <div className="chart-canvas-wrapper h-[220px]">
            <canvas ref={donutRef} />
          </div>
          <div className="donut-legend">
            {donutLegendItems.map((item) => (
              <div key={item.label} className="legend-item">
                <span
                  className="legend-dot"
                  style={{ background: item.color }}
                />
                {item.label}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mb-7">
        <div className="chart-card">
          <div className="chart-header">
            <div className="flex items-center gap-2.5 mb-1">
              <span className="text-xl">🏆</span>
              <h3>Top 3 Peserta Terbaik</h3>
            </div>
            <p>Berdasarkan penilaian performa bulan ini</p>
          </div>
          {rankings.length === 0 ? (
            <p className="text-center text-gray-400 p-8">
              Belum ada data ranking
            </p>
          ) : (
            <div className="podium-section mb-0">
              {rankings.length >= 2 && (
                <div className="podium-card podium-2">
                  <div className="podium-medal">🥈</div>
                  <div className="podium-name">
                    {(rankings[1].userId as User)?.name || "-"}
                  </div>
                  <div className="podium-instansi">
                    {(rankings[1].userId as User)?.instansi || "-"}
                  </div>
                  <div
                    className="podium-score"
                    style={{ color: getScoreColor(rankings[1].hasil) }}
                  >
                    {rankings[1].hasil}%
                  </div>
                  <div className="podium-grade">
                    {getGrade(rankings[1].hasil)}
                  </div>
                </div>
              )}
              <div className="podium-card podium-1">
                <div className="podium-medal">🥇</div>
                <div className="podium-name">
                  {(rankings[0].userId as User)?.name || "-"}
                </div>
                <div className="podium-instansi">
                  {(rankings[0].userId as User)?.instansi || "-"}
                </div>
                <div
                  className="podium-score"
                  style={{ color: getScoreColor(rankings[0].hasil) }}
                >
                  {rankings[0].hasil}%
                </div>
                <div className="podium-grade">
                  {getGrade(rankings[0].hasil)}
                </div>
              </div>
              {rankings.length >= 3 && (
                <div className="podium-card podium-3">
                  <div className="podium-medal">🥉</div>
                  <div className="podium-name">
                    {(rankings[2].userId as User)?.name || "-"}
                  </div>
                  <div className="podium-instansi">
                    {(rankings[2].userId as User)?.instansi || "-"}
                  </div>
                  <div
                    className="podium-score"
                    style={{ color: getScoreColor(rankings[2].hasil) }}
                  >
                    {rankings[2].hasil}%
                  </div>
                  <div className="podium-grade">
                    {getGrade(rankings[2].hasil)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="activity-card">
        <div className="activity-header">
          <div>
            <h3>📋 Daftar Kehadiran Hari Ini</h3>
            <p>Peserta yang sudah absen</p>
          </div>
        </div>
        {attendanceList.length === 0 ? (
          <div className="text-center p-6 text-slate-400">
            Belum ada peserta yang absen hari ini
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {attendanceList.map((r: any, i: number) => {
              const name = r.userId?.name || "Unknown";
              const initials = name
                .split(" ")
                .map((n: string) => n[0])
                .join("")
                .substring(0, 2)
                .toUpperCase();
              return (
                <div
                  key={r._id}
                  className="flex items-center justify-between px-3.5 py-2.5 bg-slate-50 rounded-[10px] border border-slate-100"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-300 to-blue-100 text-slate-800 flex items-center justify-center text-xs font-bold">
                      {initials}
                    </div>
                    <div>
                      <div className="font-semibold text-[13px]">
                        {name}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {r.userId?.instansi || "-"}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-sm text-[#0a6599]">
                      {r.jamMasuk || "-"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div className="activity-card">
        <div className="activity-header">
          <div>
            <h3>Aktivitas Terbaru</h3>
            <p>Update terkini dari peserta</p>
          </div>
        </div>
        <div className="activity-feed">
          {ra.length === 0 ? (
            <p className="text-center text-gray-400 p-8">
              Belum ada aktivitas
            </p>
          ) : (
            ra.map((a: any, i: number) => {
              const name = a.userId?.name || "Unknown";
              return (
                <div
                  key={a._id || i}
                  className="activity-feed-item"
                  style={{ animationDelay: `${i * 0.08}s` }}
                >
                  <div className="afi-icon">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  </div>
                  <div className="afi-content">
                    <div className="afi-name">{name}</div>
                    <div className="afi-desc">
                      {a.jenis}: {a.berkas} berkas, {a.buku} buku, {a.bundle}{" "}
                      bundle
                    </div>
                  </div>
                  <span className="afi-time">{getTimeAgo(a.createdAt)}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
};

export default AdminDashboard;
