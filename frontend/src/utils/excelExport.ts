/**
 * Professional Excel Export Utility using ExcelJS
 * Corporate-style reports with modern styling
 * 
 * Features:
 * - Merged title headers
 * - Modern header colors with consistent theme
 * - Full borders & zebra striping
 * - Freeze panes (header row)
 * - Auto-width columns
 * - Number / date / currency formatting
 * - Summary rows
 * - Auto-filter
 * - Sheet protection (filter-enabled)
 * - Conditional formatting
 * - Optimised for 50k+ rows
 * - Timestamped filenames
 */

import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

// ─── Theme Colors ─────────────────────────────────────────────────────────
const THEME = {
  primary: '1B4F72',       // Deep corporate blue
  primaryLight: '2E86C1',  // Lighter blue
  accent: '148F77',        // Teal accent
  headerBg: '1B4F72',      // Header background
  headerFont: 'FFFFFF',    // Header font color
  titleBg: '0D2137',       // Title background (darker)
  titleFont: 'FFFFFF',     // Title font color
  subtitleBg: '2E86C1',    // Subtitle bg
  subtitleFont: 'FFFFFF',  // Subtitle font
  infoBg: 'D6EAF8',        // Info row bg (light blue)
  infoFont: '1B4F72',      // Info row font
  zebraLight: 'F8FBFD',    // Even row
  zebraDark: 'EBF5FB',     // Odd row
  summaryBg: 'D4E6F1',     // Summary row bg
  summaryFont: '0D2137',   // Summary font
  borderColor: 'B0C4DE',   // Light steel blue borders
  negativeBg: 'FADBD8',    // Red background for negatives
  negativeFont: 'C0392B',  // Red font
  positiveBg: 'D5F5E3',    // Green bg
  positiveFont: '27AE60',  // Green font
  white: 'FFFFFF',
};

// ─── Shared Styles ────────────────────────────────────────────────────────
const FONT_FAMILY = 'Calibri';

const fullBorder = (color = THEME.borderColor): Partial<ExcelJS.Borders> => ({
  top: { style: 'thin', color: { argb: color } },
  left: { style: 'thin', color: { argb: color } },
  bottom: { style: 'thin', color: { argb: color } },
  right: { style: 'thin', color: { argb: color } },
});

const headerFill = (color = THEME.headerBg): ExcelJS.FillPattern => ({
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: color },
});

const headerFont = (size = 11): Partial<ExcelJS.Font> => ({
  name: FONT_FAMILY,
  bold: true,
  color: { argb: THEME.headerFont },
  size,
});

const bodyFont = (size = 10): Partial<ExcelJS.Font> => ({
  name: FONT_FAMILY,
  size,
  color: { argb: '2C3E50' },
});

// ─── Types ────────────────────────────────────────────────────────────────

export interface ColumnDef {
  header: string;
  key: string;
  width?: number;
  type?: 'string' | 'number' | 'date' | 'currency' | 'percent';
  /** Optional number format string, e.g. '#,##0' */
  numFmt?: string;
}

export interface SheetConfig {
  sheetName: string;
  title: string;
  subtitle?: string;
  infoLines?: string[];          // e.g. ["Filter: Bulanan", "Total: 150"]
  columns: ColumnDef[];
  data: Record<string, any>[];
  /** If provided, a summary row is added at the bottom */
  summaryRow?: Record<string, any>;
  /** summaryLabel for the first text column, default "TOTAL" */
  summaryLabel?: string;
  /** Enable conditional formatting for numeric columns: red if < 0 */
  conditionalNegative?: boolean;
}

export interface ExportOptions {
  fileName: string;
  sheets: SheetConfig[];
  /** Company/org name shown in title area */
  companyName?: string;
  /** Additional creator metadata */
  creator?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function getTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
}

function autoWidth(
  column: ColumnDef,
  data: Record<string, any>[],
  summaryRow?: Record<string, any>,
): number {
  const headerLen = column.header.length;
  let maxLen = headerLen;

  // Sample rows for performance (first 500 + last 100 for big datasets)
  const sampleSize = Math.min(data.length, 500);
  for (let i = 0; i < sampleSize; i++) {
    const val = data[i]?.[column.key];
    const len = val != null ? String(val).length : 0;
    if (len > maxLen) maxLen = len;
  }
  // Also sample tail
  if (data.length > 500) {
    const tailStart = Math.max(data.length - 100, 500);
    for (let i = tailStart; i < data.length; i++) {
      const val = data[i]?.[column.key];
      const len = val != null ? String(val).length : 0;
      if (len > maxLen) maxLen = len;
    }
  }

  // Check summary row too
  if (summaryRow && summaryRow[column.key] != null) {
    const sLen = String(summaryRow[column.key]).length;
    if (sLen > maxLen) maxLen = sLen;
  }

  // Add padding for formatted numbers (#,##0 adds commas)
  if (column.type === 'number' || column.type === 'currency') {
    maxLen = Math.max(maxLen, maxLen + Math.floor(maxLen / 3));
  }

  // Bold font is ~10% wider
  const calculatedWidth = Math.ceil(maxLen * 1.1) + 3;

  // Use explicit width as MINIMUM, but allow auto-calculated to be larger
  const minWidth = column.width || 8;
  return Math.min(Math.max(calculatedWidth, minWidth, 8), 60);
}

function getNumFormat(col: ColumnDef): string | undefined {
  if (col.numFmt) return col.numFmt;
  switch (col.type) {
    case 'number': return '#,##0';
    case 'currency': return '#,##0';
    case 'percent': return '0.00%';
    case 'date': return 'DD MMMM YYYY';
    default: return undefined;
  }
}

// ─── Main Export Function ─────────────────────────────────────────────────

export async function exportExcel(options: ExportOptions): Promise<void> {
  const { fileName, sheets, companyName, creator } = options;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = creator || 'SISMON Magang';
  workbook.created = new Date();
  workbook.modified = new Date();

  for (const sheetConfig of sheets) {
    const {
      sheetName,
      title,
      subtitle,
      infoLines = [],
      columns,
      data,
      summaryRow,
      summaryLabel = 'TOTAL',
      conditionalNegative = true,
    } = sheetConfig;

    const ws = workbook.addWorksheet(sheetName, {
      views: [{ state: 'frozen', ySplit: 0, xSplit: 0 }], // will be updated
    });

    const totalCols = columns.length;
    let currentRow = 1;

    // ─── Title Row ──────────────────────────────────────────────
    const titleRow = ws.getRow(currentRow);
    ws.mergeCells(currentRow, 1, currentRow, totalCols);
    const titleCell = ws.getCell(currentRow, 1);
    titleCell.value = companyName
      ? `${companyName} — ${title}`
      : title;
    titleCell.font = { name: FONT_FAMILY, bold: true, size: 16, color: { argb: THEME.titleFont } };
    titleCell.fill = headerFill(THEME.titleBg);
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.border = fullBorder(THEME.titleBg);
    titleRow.height = 36;
    currentRow++;

    // ─── Subtitle Row ───────────────────────────────────────────
    if (subtitle) {
      ws.mergeCells(currentRow, 1, currentRow, totalCols);
      const subCell = ws.getCell(currentRow, 1);
      subCell.value = subtitle;
      subCell.font = { name: FONT_FAMILY, bold: false, size: 11, color: { argb: THEME.subtitleFont }, italic: true };
      subCell.fill = headerFill(THEME.subtitleBg);
      subCell.alignment = { horizontal: 'center', vertical: 'middle' };
      subCell.border = fullBorder(THEME.subtitleBg);
      ws.getRow(currentRow).height = 24;
      currentRow++;
    }

    // ─── Info Lines ─────────────────────────────────────────────
    for (const info of infoLines) {
      ws.mergeCells(currentRow, 1, currentRow, totalCols);
      const infoCell = ws.getCell(currentRow, 1);
      infoCell.value = info;
      infoCell.font = { name: FONT_FAMILY, size: 10, color: { argb: THEME.infoFont }, bold: true };
      infoCell.fill = headerFill(THEME.infoBg);
      infoCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
      infoCell.border = fullBorder(THEME.borderColor);
      ws.getRow(currentRow).height = 20;
      currentRow++;
    }

    // ─── Spacer Row ─────────────────────────────────────────────
    ws.getRow(currentRow).height = 6;
    currentRow++;

    // ─── Header Row ─────────────────────────────────────────────
    const headerRowNum = currentRow;
    const headerRowObj = ws.getRow(headerRowNum);
    headerRowObj.height = 28;
    columns.forEach((col, idx) => {
      const cell = ws.getCell(headerRowNum, idx + 1);
      cell.value = col.header;
      cell.font = headerFont(11);
      cell.fill = headerFill(THEME.headerBg);
      cell.alignment = {
        horizontal: col.type === 'number' || col.type === 'currency' || col.type === 'percent' ? 'center' : 'center',
        vertical: 'middle',
        wrapText: true,
      };
      cell.border = fullBorder(THEME.white);
    });
    currentRow++;

    // ─── Data Rows ──────────────────────────────────────────────
    const dataStartRow = currentRow;
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowObj = ws.getRow(currentRow);
      const isEven = i % 2 === 0;
      let maxLineCount = 1;

      columns.forEach((col, colIdx) => {
        const cell = ws.getCell(currentRow, colIdx + 1);
        let value = row[col.key];

        // Handle date values
        if (col.type === 'date' && value && !(value instanceof Date)) {
          value = typeof value === 'string' ? value : new Date(value);
        }

        cell.value = value ?? '';
        cell.font = bodyFont(10);
        cell.fill = headerFill(isEven ? THEME.zebraLight : THEME.zebraDark);
        cell.border = fullBorder(THEME.borderColor);

        // Alignment
        if (col.type === 'number' || col.type === 'currency' || col.type === 'percent') {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else if (col.key === 'no') {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else {
          cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
        }

        // Number format
        const fmt = getNumFormat(col);
        if (fmt && (col.type === 'number' || col.type === 'currency' || col.type === 'percent')) {
          cell.numFmt = fmt;
        }

        // Conditional formatting for negative numbers
        if (conditionalNegative && typeof value === 'number' && value < 0) {
          cell.font = { ...bodyFont(10), color: { argb: THEME.negativeFont }, bold: true };
          cell.fill = headerFill(THEME.negativeBg);
        }

        // Track line count for auto row height
        if (value != null && typeof value === 'string') {
          const colW = col.width || 20;
          const estimatedLines = Math.ceil(value.length / (colW - 2)) || 1;
          const newlineCount = (value.match(/\n/g) || []).length + 1;
          const lines = Math.max(estimatedLines, newlineCount);
          if (lines > maxLineCount) maxLineCount = lines;
        }
      });

      // Auto row height: base 22px, scale up for multi-line content
      rowObj.height = Math.max(22, Math.min(maxLineCount * 16, 80));
      currentRow++;
    }

    // ─── Summary Row ────────────────────────────────────────────
    if (summaryRow) {
      // Thin separator
      const sepRow = ws.getRow(currentRow);
      sepRow.height = 4;
      currentRow++;

      const sumRowObj = ws.getRow(currentRow);
      sumRowObj.height = 28;
      columns.forEach((col, colIdx) => {
        const cell = ws.getCell(currentRow, colIdx + 1);
        if (colIdx === 0 || (col.type !== 'number' && col.type !== 'currency' && !summaryRow[col.key])) {
          // Label cell
          if (colIdx === 0) {
            cell.value = summaryLabel;
          } else if (summaryRow[col.key] !== undefined) {
            cell.value = summaryRow[col.key];
          } else {
            cell.value = '';
          }
        } else {
          cell.value = summaryRow[col.key] ?? '';
        }
        cell.font = { name: FONT_FAMILY, bold: true, size: 11, color: { argb: THEME.summaryFont } };
        cell.fill = headerFill(THEME.summaryBg);
        cell.border = {
          top: { style: 'double', color: { argb: THEME.primary } },
          left: { style: 'thin', color: { argb: THEME.borderColor } },
          bottom: { style: 'double', color: { argb: THEME.primary } },
          right: { style: 'thin', color: { argb: THEME.borderColor } },
        };
        cell.alignment = {
          horizontal: col.type === 'number' || col.type === 'currency' ? 'center' : (colIdx === 0 ? 'center' : 'left'),
          vertical: 'middle',
        };
        const fmt = getNumFormat(col);
        if (fmt && (col.type === 'number' || col.type === 'currency')) {
          cell.numFmt = fmt;
        }
      });
      currentRow++;
    }

    // ─── Footer ─────────────────────────────────────────────────
    currentRow++; // spacer
    ws.mergeCells(currentRow, 1, currentRow, totalCols);
    const footerCell = ws.getCell(currentRow, 1);
    const now = new Date();
    const dateStr = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    footerCell.value = `Dicetak pada: ${dateStr}, ${timeStr} WIB`;
    footerCell.font = { name: FONT_FAMILY, size: 9, italic: true, color: { argb: '7F8C8D' } };
    footerCell.alignment = { horizontal: 'right', vertical: 'middle' };

    // ─── Column Widths (true auto-fit) ────────────────────────────
    columns.forEach((col, idx) => {
      const wsCol = ws.getColumn(idx + 1);
      wsCol.width = autoWidth(col, data, summaryRow);
    });

    // ─── Auto Filter ────────────────────────────────────────────
    ws.autoFilter = {
      from: { row: headerRowNum, column: 1 },
      to: { row: headerRowNum, column: totalCols },
    };

    // No freeze panes

    // ─── Sheet Protection ───────────────────────────────────────
    ws.protect('', {
      autoFilter: true,
      sort: true,
      selectLockedCells: true,
      selectUnlockedCells: true,
    });

    // ─── Print Setup ────────────────────────────────────────────
    ws.pageSetup = {
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      paperSize: 9, // A4
    };
  }

  // ─── Generate & Download ──────────────────────────────────────
  const timestamp = getTimestamp();
  const fullName = `${fileName}_${timestamp}.xlsx`;
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  saveAs(blob, fullName);
}

// ─── Convenience: Rekapitulasi Pivot Export ──────────────────────────────

export interface PivotCell {
  berkas: number;
  buku: number;
  bundle: number;
  total: number;
}

export interface PivotRow {
  userName: string;
  cells: Record<string, PivotCell>;
  grandTotal: number;
}

export async function exportRekapitulasiExcel(
  jenisList: string[],
  pivotRows: PivotRow[],
  totalsRow: Record<string, PivotCell>,
  grandTotalAll: number,
  filterInfo?: string,
  biayaData?: {
    upahHarian: number;
    getBiayaPerBerkas: (jobDesk: string) => number;
  },
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SISMON Magang';
  workbook.created = new Date();

  const subColCount = 4; // berkas,buku,bundle,total per jenis
  const totalCols = 2 + jenisList.length * subColCount + 1; // no + nama + jenis*4 + grandTotal

  // ══════════════════════════════════════════════════════════════
  // SHEET 1: Rekapitulasi Pekerjaan (Original - Blue theme)
  // ══════════════════════════════════════════════════════════════
  const ws = workbook.addWorksheet('Rekapitulasi');

  let currentRow = 1;

  // ─── Title ────────────────────────────────────────────────────
  ws.mergeCells(currentRow, 1, currentRow, totalCols);
  const titleCell = ws.getCell(currentRow, 1);
  titleCell.value = 'REKAPITULASI PEKERJAAN';
  titleCell.font = { name: FONT_FAMILY, bold: true, size: 16, color: { argb: THEME.titleFont } };
  titleCell.fill = headerFill(THEME.titleBg);
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  titleCell.border = fullBorder(THEME.titleBg);
  ws.getRow(currentRow).height = 36;
  currentRow++;

  // Subtitle
  ws.mergeCells(currentRow, 1, currentRow, totalCols);
  const subCell = ws.getCell(currentRow, 1);
  subCell.value = 'Sistem Monitoring Magang';
  subCell.font = { name: FONT_FAMILY, size: 11, italic: true, color: { argb: THEME.subtitleFont } };
  subCell.fill = headerFill(THEME.subtitleBg);
  subCell.alignment = { horizontal: 'center', vertical: 'middle' };
  subCell.border = fullBorder(THEME.subtitleBg);
  ws.getRow(currentRow).height = 24;
  currentRow++;

  // Info lines
  const infoTexts = [
    `Total Peserta: ${pivotRows.length}`,
    `Total Pekerjaan: ${grandTotalAll}`,
  ];
  if (filterInfo) infoTexts.push(`Filter: ${filterInfo}`);
  for (const info of infoTexts) {
    ws.mergeCells(currentRow, 1, currentRow, totalCols);
    const infoCell = ws.getCell(currentRow, 1);
    infoCell.value = info;
    infoCell.font = { name: FONT_FAMILY, size: 10, bold: true, color: { argb: THEME.infoFont } };
    infoCell.fill = headerFill(THEME.infoBg);
    infoCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    infoCell.border = fullBorder(THEME.borderColor);
    ws.getRow(currentRow).height = 20;
    currentRow++;
  }

  // Spacer
  ws.getRow(currentRow).height = 6;
  currentRow++;

  // ─── Header Row 1 (merged jenis names) ──────────────────────
  const h1Row = currentRow;
  ws.getRow(h1Row).height = 28;

  // "No" header merged across 2 rows
  ws.mergeCells(h1Row, 1, h1Row + 1, 1);
  const noCell = ws.getCell(h1Row, 1);
  noCell.value = 'No';
  noCell.font = headerFont(11);
  noCell.fill = headerFill(THEME.headerBg);
  noCell.alignment = { horizontal: 'center', vertical: 'middle' };
  noCell.border = fullBorder(THEME.white);

  // "Nama Peserta" header merged across 2 rows
  ws.mergeCells(h1Row, 2, h1Row + 1, 2);
  const namaCell = ws.getCell(h1Row, 2);
  namaCell.value = 'NAMA PESERTA';
  namaCell.font = headerFont(11);
  namaCell.fill = headerFill(THEME.headerBg);
  namaCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  namaCell.border = fullBorder(THEME.white);

  let col = 3;
  jenisList.forEach((j) => {
    ws.mergeCells(h1Row, col, h1Row, col + subColCount - 1);
    const cell = ws.getCell(h1Row, col);
    cell.value = j.toUpperCase();
    cell.font = headerFont(11);
    cell.fill = headerFill(THEME.headerBg);
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = fullBorder(THEME.white);
    col += subColCount;
  });

  // Grand Total header merged across 2 rows
  ws.mergeCells(h1Row, col, h1Row + 1, col);
  const gtHeaderCell = ws.getCell(h1Row, col);
  gtHeaderCell.value = 'GRAND TOTAL';
  gtHeaderCell.font = headerFont(11);
  gtHeaderCell.fill = headerFill(THEME.accent);
  gtHeaderCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  gtHeaderCell.border = fullBorder(THEME.white);

  currentRow++;

  // ─── Header Row 2 (sub-columns) ────────────────────────────
  ws.getRow(currentRow).height = 24;
  // No and Nama Peserta cells are already merged
  col = 3;
  const subHeaders = ['Berkas', 'Buku', 'Bundle', 'Total'];
  jenisList.forEach(() => {
    subHeaders.forEach((sh, si) => {
      const cell = ws.getCell(currentRow, col + si);
      cell.value = sh;
      cell.font = headerFont(10);
      cell.fill = headerFill(si === 3 ? THEME.primaryLight : THEME.headerBg);
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = fullBorder(THEME.white);
    });
    col += subColCount;
  });
  // Grand total already merged
  currentRow++;

  const freezeRow = currentRow - 1; // freeze after header

  // Pre-calculate nama column width for auto row height
  let maxNameLen = 'NAMA PESERTA'.length;
  for (const pr of pivotRows) {
    if (pr.userName.length > maxNameLen) maxNameLen = pr.userName.length;
  }
  const namaColWidth = Math.min(Math.max(maxNameLen + 3, 18), 35);

  // ─── Data Rows ────────────────────────────────────────────────
  for (let i = 0; i < pivotRows.length; i++) {
    const pr = pivotRows[i];
    const isEven = i % 2 === 0;
    const rowObj = ws.getRow(currentRow);
    // Auto row height based on name length vs column width
    const nameLines = Math.ceil(pr.userName.length / (namaColWidth - 2)) || 1;
    rowObj.height = Math.max(22, Math.min(nameLines * 16, 60));

    // No
    const noDataCell = ws.getCell(currentRow, 1);
    noDataCell.value = i + 1;
    noDataCell.font = bodyFont(10);
    noDataCell.fill = headerFill(isEven ? THEME.zebraLight : THEME.zebraDark);
    noDataCell.alignment = { horizontal: 'center', vertical: 'middle' };
    noDataCell.border = fullBorder(THEME.borderColor);

    // Nama Peserta
    const namaDataCell = ws.getCell(currentRow, 2);
    namaDataCell.value = pr.userName;
    namaDataCell.font = { ...bodyFont(10), bold: true };
    namaDataCell.fill = headerFill(isEven ? THEME.zebraLight : THEME.zebraDark);
    namaDataCell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
    namaDataCell.border = fullBorder(THEME.borderColor);

    col = 3;
    jenisList.forEach((j) => {
      const c = pr.cells[j] || { berkas: 0, buku: 0, bundle: 0, total: 0 };
      const values = [c.berkas, c.buku, c.bundle, c.total];
      values.forEach((v, vi) => {
        const cell = ws.getCell(currentRow, col + vi);
        cell.value = v;
        cell.font = bodyFont(10);
        cell.fill = headerFill(isEven ? THEME.zebraLight : THEME.zebraDark);
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = fullBorder(THEME.borderColor);
        cell.numFmt = '#,##0';
        // Highlight total sub-column
        if (vi === 3 && v > 0) {
          cell.font = { ...bodyFont(10), bold: true, color: { argb: THEME.primary } };
        }
      });
      col += subColCount;
    });

    // Grand total
    const gtCell = ws.getCell(currentRow, col);
    gtCell.value = pr.grandTotal;
    gtCell.font = { name: FONT_FAMILY, bold: true, size: 11, color: { argb: THEME.white } };
    gtCell.fill = headerFill(THEME.accent);
    gtCell.alignment = { horizontal: 'center', vertical: 'middle' };
    gtCell.border = fullBorder(THEME.borderColor);
    gtCell.numFmt = '#,##0';

    currentRow++;
  }

  // ─── Summary Row ──────────────────────────────────────────────
  const sepRow = ws.getRow(currentRow);
  sepRow.height = 4;
  currentRow++;

  const sumRowObj = ws.getRow(currentRow);
  sumRowObj.height = 30;

  // TOTAL label (merge No + Nama columns)
  ws.mergeCells(currentRow, 1, currentRow, 2);
  const totalLabelCell = ws.getCell(currentRow, 1);
  totalLabelCell.value = 'TOTAL';
  totalLabelCell.font = { name: FONT_FAMILY, bold: true, size: 12, color: { argb: THEME.summaryFont } };
  totalLabelCell.fill = headerFill(THEME.summaryBg);
  totalLabelCell.alignment = { horizontal: 'center', vertical: 'middle' };
  totalLabelCell.border = {
    top: { style: 'double', color: { argb: THEME.primary } },
    left: { style: 'thin', color: { argb: THEME.borderColor } },
    bottom: { style: 'double', color: { argb: THEME.primary } },
    right: { style: 'thin', color: { argb: THEME.borderColor } },
  };

  col = 3;
  jenisList.forEach((j) => {
    const t = totalsRow[j] || { berkas: 0, buku: 0, bundle: 0, total: 0 };
    const values = [t.berkas, t.buku, t.bundle, t.total];
    values.forEach((v, vi) => {
      const cell = ws.getCell(currentRow, col + vi);
      cell.value = v;
      cell.font = { name: FONT_FAMILY, bold: true, size: 11, color: { argb: THEME.summaryFont } };
      cell.fill = headerFill(THEME.summaryBg);
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'double', color: { argb: THEME.primary } },
        left: { style: 'thin', color: { argb: THEME.borderColor } },
        bottom: { style: 'double', color: { argb: THEME.primary } },
        right: { style: 'thin', color: { argb: THEME.borderColor } },
      };
      cell.numFmt = '#,##0';
    });
    col += subColCount;
  });

  // Grand total summary
  const gtSumCell = ws.getCell(currentRow, col);
  gtSumCell.value = grandTotalAll;
  gtSumCell.font = { name: FONT_FAMILY, bold: true, size: 13, color: { argb: THEME.white } };
  gtSumCell.fill = headerFill(THEME.titleBg);
  gtSumCell.alignment = { horizontal: 'center', vertical: 'middle' };
  gtSumCell.border = {
    top: { style: 'double', color: { argb: THEME.primary } },
    left: { style: 'thin', color: { argb: THEME.borderColor } },
    bottom: { style: 'double', color: { argb: THEME.primary } },
    right: { style: 'thin', color: { argb: THEME.borderColor } },
  };
  gtSumCell.numFmt = '#,##0';
  currentRow++;

  // Footer
  currentRow++;
  ws.mergeCells(currentRow, 1, currentRow, totalCols);
  const footerCell = ws.getCell(currentRow, 1);
  const now = new Date();
  const dateStr = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  footerCell.value = `Dicetak pada: ${dateStr}, ${timeStr} WIB`;
  footerCell.font = { name: FONT_FAMILY, size: 9, italic: true, color: { argb: '7F8C8D' } };
  footerCell.alignment = { horizontal: 'right', vertical: 'middle' };

  // ─── Column widths (auto-fit) ─────────────────────────────────
  // No column
  ws.getColumn(1).width = 6;

  // Nama Peserta — use pre-calculated width
  ws.getColumn(2).width = namaColWidth;

  col = 3;
  jenisList.forEach(() => {
    for (let si = 0; si < subColCount; si++) {
      ws.getColumn(col + si).width = si === 3 ? 10 : 9;
    }
    col += subColCount;
  });
  ws.getColumn(col).width = 14;

  // Freeze panes
  // No freeze panes

  // Auto-filter on header row 2 (sub-headers)
  ws.autoFilter = {
    from: { row: freezeRow, column: 1 },
    to: { row: freezeRow, column: totalCols },
  };

  // Protection
  ws.protect('', {
    autoFilter: true,
    sort: true,
    selectLockedCells: true,
    selectUnlockedCells: true,
  });

  // Print setup
  ws.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    paperSize: 9,
  };

  // ══════════════════════════════════════════════════════════════
  // SHEET 2: Rincian Biaya (Amber/Gold theme)
  // ══════════════════════════════════════════════════════════════
  if (biayaData && biayaData.upahHarian > 0) {
    const AMBER = {
      titleBg: '78350F',       // Dark amber
      titleFont: 'FFFFFF',
      subtitleBg: 'B45309',    // Medium amber
      subtitleFont: 'FFFFFF',
      headerBg: '92400E',      // Brown amber
      headerLight: 'D97706',   // Lighter amber
      headerSub: 'F59E0B',     // Amber
      infoBg: 'FEF3C7',        // Light amber
      infoFont: '92400E',
      accentBg: '78350F',      // Dark accent for totals
      zebraLight: 'FFFBEB',    // Very light amber
      zebraDark: 'FEF3C7',     // Light amber
      summaryBg: 'FDE68A',     // Amber summary
      summaryFont: '78350F',
      borderColor: 'F59E0B',
      subtotalFont: 'B45309',
    };

    const formatRp = (v: number) => {
      return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
    };

    const ws2 = workbook.addWorksheet('Rincian Biaya');

    let cr = 1; // current row for sheet 2

    // ─── Title ──────────────────────────────────────────────────
    ws2.mergeCells(cr, 1, cr, totalCols);
    const t2 = ws2.getCell(cr, 1);
    t2.value = 'RINCIAN BIAYA PER BERKAS';
    t2.font = { name: FONT_FAMILY, bold: true, size: 16, color: { argb: AMBER.titleFont } };
    t2.fill = headerFill(AMBER.titleBg);
    t2.alignment = { horizontal: 'center', vertical: 'middle' };
    t2.border = fullBorder(AMBER.titleBg);
    ws2.getRow(cr).height = 36;
    cr++;

    // Subtitle
    ws2.mergeCells(cr, 1, cr, totalCols);
    const s2 = ws2.getCell(cr, 1);
    s2.value = 'Biaya = jumlah item x (Upah Harian / Target per section)';
    s2.font = { name: FONT_FAMILY, size: 11, italic: true, color: { argb: AMBER.subtitleFont } };
    s2.fill = headerFill(AMBER.subtitleBg);
    s2.alignment = { horizontal: 'center', vertical: 'middle' };
    s2.border = fullBorder(AMBER.subtitleBg);
    ws2.getRow(cr).height = 24;
    cr++;

    // Info lines
    const biayaGrandTotal = jenisList.reduce((sum, j) => sum + totalsRow[j].total * biayaData.getBiayaPerBerkas(j), 0);
    const info2 = [
      `Upah Harian: ${formatRp(biayaData.upahHarian)}`,
      `Total Peserta: ${pivotRows.length}`,
      `Total Biaya: ${formatRp(biayaGrandTotal)}`,
    ];
    if (filterInfo) info2.push(`Filter: ${filterInfo}`);
    for (const info of info2) {
      ws2.mergeCells(cr, 1, cr, totalCols);
      const ic = ws2.getCell(cr, 1);
      ic.value = info;
      ic.font = { name: FONT_FAMILY, size: 10, bold: true, color: { argb: AMBER.infoFont } };
      ic.fill = headerFill(AMBER.infoBg);
      ic.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
      ic.border = fullBorder(AMBER.borderColor);
      ws2.getRow(cr).height = 20;
      cr++;
    }

    // Spacer
    ws2.getRow(cr).height = 6;
    cr++;

    // ─── Header Row 1 (merged jenis) ───────────────────────────
    const bh1 = cr;
    ws2.getRow(bh1).height = 32;

    // No
    ws2.mergeCells(bh1, 1, bh1 + 1, 1);
    const bNoCell = ws2.getCell(bh1, 1);
    bNoCell.value = 'No';
    bNoCell.font = headerFont(11);
    bNoCell.fill = headerFill(AMBER.headerBg);
    bNoCell.alignment = { horizontal: 'center', vertical: 'middle' };
    bNoCell.border = fullBorder(AMBER.titleFont);

    // Nama Peserta
    ws2.mergeCells(bh1, 2, bh1 + 1, 2);
    const bNamaCell = ws2.getCell(bh1, 2);
    bNamaCell.value = 'NAMA PESERTA';
    bNamaCell.font = headerFont(11);
    bNamaCell.fill = headerFill(AMBER.headerBg);
    bNamaCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    bNamaCell.border = fullBorder(AMBER.titleFont);

    let bc = 3;
    jenisList.forEach((j) => {
      ws2.mergeCells(bh1, bc, bh1, bc + subColCount - 1);
      const cell = ws2.getCell(bh1, bc);
      const rate = biayaData.getBiayaPerBerkas(j);
      cell.value = rate > 0 ? `${j.toUpperCase()} (${formatRp(rate)}/item)` : j.toUpperCase();
      cell.font = headerFont(10);
      cell.fill = headerFill(AMBER.headerLight);
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = fullBorder(AMBER.titleFont);
      bc += subColCount;
    });

    // Grand total
    ws2.mergeCells(bh1, bc, bh1 + 1, bc);
    const bGtCell = ws2.getCell(bh1, bc);
    bGtCell.value = 'GRAND TOTAL';
    bGtCell.font = headerFont(11);
    bGtCell.fill = headerFill(AMBER.accentBg);
    bGtCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    bGtCell.border = fullBorder(AMBER.titleFont);
    cr++;

    // ─── Header Row 2 (sub-columns) ────────────────────────────
    ws2.getRow(cr).height = 24;
    bc = 3;
    jenisList.forEach(() => {
      subHeaders.forEach((sh, si) => {
        const cell = ws2.getCell(cr, bc + si);
        cell.value = sh;
        cell.font = headerFont(10);
        cell.fill = headerFill(si === 3 ? AMBER.headerLight : AMBER.headerSub);
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = fullBorder(AMBER.titleFont);
      });
      bc += subColCount;
    });
    cr++;

    const bFreezeRow = cr - 1;

    // ─── Data Rows ──────────────────────────────────────────────
    for (let i = 0; i < pivotRows.length; i++) {
      const pr = pivotRows[i];
      const isEven = i % 2 === 0;
      const rowObj = ws2.getRow(cr);
      const nameLines = Math.ceil(pr.userName.length / (namaColWidth - 2)) || 1;
      rowObj.height = Math.max(22, Math.min(nameLines * 16, 60));

      // No
      const bnd = ws2.getCell(cr, 1);
      bnd.value = i + 1;
      bnd.font = bodyFont(10);
      bnd.fill = headerFill(isEven ? AMBER.zebraLight : AMBER.zebraDark);
      bnd.alignment = { horizontal: 'center', vertical: 'middle' };
      bnd.border = fullBorder(AMBER.borderColor);

      // Nama
      const bnn = ws2.getCell(cr, 2);
      bnn.value = pr.userName;
      bnn.font = { ...bodyFont(10), bold: true };
      bnn.fill = headerFill(isEven ? AMBER.zebraLight : AMBER.zebraDark);
      bnn.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
      bnn.border = fullBorder(AMBER.borderColor);

      bc = 3;
      let rowBiayaTotal = 0;
      jenisList.forEach((j) => {
        const c = pr.cells[j] || { berkas: 0, buku: 0, bundle: 0, total: 0 };
        const rate = biayaData.getBiayaPerBerkas(j);
        const biayaValues = [c.berkas * rate, c.buku * rate, c.bundle * rate, (c.berkas + c.buku + c.bundle) * rate];
        rowBiayaTotal += biayaValues[3];
        biayaValues.forEach((v, vi) => {
          const cell = ws2.getCell(cr, bc + vi);
          cell.value = rate > 0 ? v : 0;
          cell.font = bodyFont(9);
          cell.fill = headerFill(isEven ? AMBER.zebraLight : AMBER.zebraDark);
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          cell.border = fullBorder(AMBER.borderColor);
          cell.numFmt = '#,##0';
          if (vi === 3 && v > 0) {
            cell.font = { ...bodyFont(9), bold: true, color: { argb: AMBER.subtotalFont } };
          }
        });
        bc += subColCount;
      });

      // Grand total
      const bgt = ws2.getCell(cr, bc);
      bgt.value = rowBiayaTotal;
      bgt.font = { name: FONT_FAMILY, bold: true, size: 10, color: { argb: AMBER.titleFont } };
      bgt.fill = headerFill(AMBER.accentBg);
      bgt.alignment = { horizontal: 'right', vertical: 'middle' };
      bgt.border = fullBorder(AMBER.borderColor);
      bgt.numFmt = '#,##0';

      cr++;
    }

    // ─── Summary Row ─────────────────────────────────────────────
    const bSep = ws2.getRow(cr);
    bSep.height = 4;
    cr++;

    const bSumRow = ws2.getRow(cr);
    bSumRow.height = 30;

    ws2.mergeCells(cr, 1, cr, 2);
    const bTotLabel = ws2.getCell(cr, 1);
    bTotLabel.value = 'TOTAL';
    bTotLabel.font = { name: FONT_FAMILY, bold: true, size: 12, color: { argb: AMBER.summaryFont } };
    bTotLabel.fill = headerFill(AMBER.summaryBg);
    bTotLabel.alignment = { horizontal: 'center', vertical: 'middle' };
    bTotLabel.border = {
      top: { style: 'double', color: { argb: AMBER.headerLight } },
      left: { style: 'thin', color: { argb: AMBER.borderColor } },
      bottom: { style: 'double', color: { argb: AMBER.headerLight } },
      right: { style: 'thin', color: { argb: AMBER.borderColor } },
    };

    bc = 3;
    jenisList.forEach((j) => {
      const t = totalsRow[j] || { berkas: 0, buku: 0, bundle: 0, total: 0 };
      const rate = biayaData.getBiayaPerBerkas(j);
      const biayaValues = [t.berkas * rate, t.buku * rate, t.bundle * rate, t.total * rate];
      biayaValues.forEach((v, vi) => {
        const cell = ws2.getCell(cr, bc + vi);
        cell.value = rate > 0 ? v : 0;
        cell.font = { name: FONT_FAMILY, bold: true, size: 10, color: { argb: AMBER.summaryFont } };
        cell.fill = headerFill(AMBER.summaryBg);
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.border = {
          top: { style: 'double', color: { argb: AMBER.headerLight } },
          left: { style: 'thin', color: { argb: AMBER.borderColor } },
          bottom: { style: 'double', color: { argb: AMBER.headerLight } },
          right: { style: 'thin', color: { argb: AMBER.borderColor } },
        };
        cell.numFmt = '#,##0';
      });
      bc += subColCount;
    });

    // Grand total summary
    const bGtSum = ws2.getCell(cr, bc);
    bGtSum.value = biayaGrandTotal;
    bGtSum.font = { name: FONT_FAMILY, bold: true, size: 12, color: { argb: AMBER.titleFont } };
    bGtSum.fill = headerFill(AMBER.titleBg);
    bGtSum.alignment = { horizontal: 'right', vertical: 'middle' };
    bGtSum.border = {
      top: { style: 'double', color: { argb: AMBER.headerLight } },
      left: { style: 'thin', color: { argb: AMBER.borderColor } },
      bottom: { style: 'double', color: { argb: AMBER.headerLight } },
      right: { style: 'thin', color: { argb: AMBER.borderColor } },
    };
    bGtSum.numFmt = '#,##0';
    cr++;

    // Footer
    cr++;
    ws2.mergeCells(cr, 1, cr, totalCols);
    const bFooter = ws2.getCell(cr, 1);
    bFooter.value = `Dicetak pada: ${dateStr}, ${timeStr} WIB`;
    bFooter.font = { name: FONT_FAMILY, size: 9, italic: true, color: { argb: '7F8C8D' } };
    bFooter.alignment = { horizontal: 'right', vertical: 'middle' };

    // Column widths
    ws2.getColumn(1).width = 6;
    ws2.getColumn(2).width = namaColWidth;
    bc = 3;
    jenisList.forEach(() => {
      for (let si = 0; si < subColCount; si++) {
        ws2.getColumn(bc + si).width = si === 3 ? 14 : 12;
      }
      bc += subColCount;
    });
    ws2.getColumn(bc).width = 16;

    // No freeze panes

    // Protection
    ws2.protect('', {
      autoFilter: true,
      sort: true,
      selectLockedCells: true,
      selectUnlockedCells: true,
    });

    // Print setup
    ws2.pageSetup = {
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      paperSize: 9,
    };
  }

  // ─── Save ─────────────────────────────────────────────────────
  const timestamp = getTimestamp();
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  saveAs(blob, `Rekapitulasi_Pekerjaan_${timestamp}.xlsx`);
}
