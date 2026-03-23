import { Image, Platform } from 'react-native';
import * as ExpoPrint from 'expo-print';
import shopLogo from '../../assets/shop_logo.png';

export async function printAsync(options) {
  if (Platform.OS === 'web') {
    // Use browser print API
    if (options.html) {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Print</title>
              <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
              </style>
            </head>
            <body>
              ${options.html}
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
        }, 100);
      }
    }
    return;
  }
  // Native: use expo-print
  return ExpoPrint.printAsync(options);
}

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const PAGE_MARGIN = 40;
const ROW_HEIGHT = 18;
const BRAND_PRIMARY = { r: 5 / 255, g: 25 / 255, b: 84 / 255 };
const BRAND_LIGHT = { r: 234 / 255, g: 240 / 255, b: 252 / 255 };
const TABLE_BORDER = { r: 220 / 255, g: 224 / 255, b: 232 / 255 };
const TABLE_ALT = { r: 248 / 255, g: 250 / 255, b: 255 / 255 };

const safeText = (value) => {
  const raw = String(value ?? '');
  // Standard PDF fonts in pdf-lib use WinAnsi; strip unsupported unicode to prevent export crashes.
  return raw
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E\n\r\t]/g, '?');
};

const formatMoney = (value) => {
  const amount = Number(value || 0);
  return `PHP ${amount.toFixed(2)}`;
};

function drawTitle(page, fontBold, text) {
  page.drawText(text, {
    x: PAGE_MARGIN,
    y: PAGE_HEIGHT - PAGE_MARGIN,
    size: 18,
    font: fontBold,
  });
}

async function loadLogoForPdf(pdfDoc) {
  const embedFromUri = async (uri) => {
    if (!uri) return null;
    const response = await fetch(uri);
    if (!response.ok) return null;
    const bytes = await response.arrayBuffer();
    try {
      return await pdfDoc.embedPng(bytes);
    } catch {
      return await pdfDoc.embedJpg(bytes);
    }
  };

  try {
    if (typeof shopLogo === 'string') {
      const embedded = await embedFromUri(shopLogo);
      if (embedded) return embedded;
    }

    const logoAsset = Image.resolveAssetSource(require('../../assets/shop_logo.png'));
    if (logoAsset?.uri) {
      const embedded = await embedFromUri(logoAsset.uri);
      if (embedded) return embedded;
    }

    return null;
  } catch {
    return null;
  }
}

function drawReportHeader(page, font, fontBold, logo, shopName, reportTitle, generatedAt, rangeLabel) {
  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 108,
    width: PAGE_WIDTH,
    height: 108,
    color: BRAND_LIGHT,
  });

  const titleY = PAGE_HEIGHT - PAGE_MARGIN;
  let textX = PAGE_MARGIN;

  if (logo) {
    const logoWidth = 42;
    const logoHeight = 42;
    page.drawImage(logo, {
      x: PAGE_MARGIN,
      y: titleY - logoHeight + 6,
      width: logoWidth,
      height: logoHeight,
    });
    textX += logoWidth + 12;
  }

  page.drawText(safeText(shopName), {
    x: textX,
    y: titleY,
    size: 16,
    font: fontBold,
    color: BRAND_PRIMARY,
  });
  page.drawText(safeText(reportTitle), {
    x: textX,
    y: titleY - 18,
    size: 11,
    font,
  });
  page.drawText(safeText(`Range: ${rangeLabel}`), {
    x: textX,
    y: titleY - 32,
    size: 10,
    font,
  });
  page.drawText(safeText(`Generated: ${generatedAt}`), {
    x: textX,
    y: titleY - 45,
    size: 10,
    font,
  });

  page.drawLine({
    start: { x: PAGE_MARGIN, y: PAGE_HEIGHT - 110 },
    end: { x: PAGE_WIDTH - PAGE_MARGIN, y: PAGE_HEIGHT - 110 },
    thickness: 1,
    color: TABLE_BORDER,
  });
}

function ensureSpace(state, pdfDoc, fontBold, neededHeight) {
  if (state.y - neededHeight >= PAGE_MARGIN) return state;
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  if (state.headerMeta) {
    drawReportHeader(
      page,
      state.headerMeta.font,
      fontBold,
      state.headerMeta.logo,
      state.headerMeta.shopName,
      state.headerMeta.reportTitle,
      state.headerMeta.generatedAt,
      state.headerMeta.rangeLabel
    );
  } else {
    drawTitle(page, fontBold, 'Sales Report');
  }
  return { ...state, page, y: PAGE_HEIGHT - PAGE_MARGIN - 88 };
}

function drawSectionTitle(state, pdfDoc, fontBold, title) {
  const next = ensureSpace(state, pdfDoc, fontBold, 24);
  next.page.drawText(title, {
    x: PAGE_MARGIN,
    y: next.y,
    size: 13,
    font: fontBold,
  });
  return { ...next, y: next.y - 20 };
}

function drawLine(state, pdfDoc, font, fontBold, text, isBold = false) {
  const next = ensureSpace(state, pdfDoc, fontBold, 16);
  next.page.drawText(safeText(text), {
    x: PAGE_MARGIN,
    y: next.y,
    size: 10,
    font: isBold ? fontBold : font,
  });
  return { ...next, y: next.y - 14 };
}

function drawTable(state, pdfDoc, font, fontBold, headers, rows) {
  let next = ensureSpace(state, pdfDoc, fontBold, 22);
  const tableWidth = PAGE_WIDTH - PAGE_MARGIN * 2;
  const colWidths = headers.length === 3
    ? [tableWidth * 0.46, tableWidth * 0.24, tableWidth * 0.30]
    : headers.length === 2
      ? [tableWidth * 0.65, tableWidth * 0.35]
      : new Array(headers.length).fill(tableWidth / headers.length);
  const normalizedRows = Array.isArray(rows) && rows.length
    ? rows
    : [[
      'No data available',
      ...new Array(Math.max(0, headers.length - 1)).fill('-'),
    ]];

  const headerTop = next.y + 3;
  next.page.drawRectangle({
    x: PAGE_MARGIN,
    y: headerTop - ROW_HEIGHT + 4,
    width: tableWidth,
    height: ROW_HEIGHT,
    color: BRAND_LIGHT,
    borderColor: TABLE_BORDER,
    borderWidth: 0.5,
  });

  headers.forEach((header, index) => {
    const xOffset = colWidths.slice(0, index).reduce((sum, width) => sum + width, 0);
    next.page.drawText(safeText(header), {
      x: PAGE_MARGIN + xOffset + 4,
      y: next.y,
      size: 10,
      font: fontBold,
      color: BRAND_PRIMARY,
    });
  });

  next.y -= ROW_HEIGHT;

  normalizedRows.forEach((row, rowIndex) => {
    next = ensureSpace(next, pdfDoc, fontBold, ROW_HEIGHT);
    if (rowIndex % 2 === 1) {
      next.page.drawRectangle({
        x: PAGE_MARGIN,
        y: next.y - 3,
        width: tableWidth,
        height: ROW_HEIGHT,
        color: TABLE_ALT,
      });
    }
    row.forEach((cell, index) => {
      const xOffset = colWidths.slice(0, index).reduce((sum, width) => sum + width, 0);
      const text = safeText(cell);
      const clipped = text.length > 44 ? `${text.slice(0, 41)}...` : text;
      next.page.drawText(clipped, {
        x: PAGE_MARGIN + xOffset + 4,
        y: next.y,
        size: 10,
        font,
      });
    });
    next.y -= ROW_HEIGHT;
  });

  return { ...next, y: next.y - 6 };
}

async function savePdfBytesOnWeb(pdfBytes, fileName, fileHandle, popupWindow) {
  if (typeof window === 'undefined') return;

  if (fileHandle) {
    const writable = await fileHandle.createWritable();
    await writable.write(pdfBytes);
    await writable.close();
    return;
  }

  const supportsSavePicker = typeof window.showSaveFilePicker === 'function' && window.isSecureContext;
  if (supportsSavePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: fileName,
        types: [
          {
            description: 'PDF Document',
            accept: { 'application/pdf': ['.pdf'] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(pdfBytes);
      await writable.close();
      return;
    } catch (error) {
      // If picker fails (unsupported, blocked, or aborted), continue to download fallback.
      if (error?.name === 'AbortError') {
        return;
      }
    }
  }

  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = window.URL.createObjectURL(blob);

  // If we reserved a popup, close it since navigating it to a blob: URI often hangs in modern browsers.
  if (popupWindow && !popupWindow.closed) {
    try {
      popupWindow.close();
    } catch {}
  }

  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    // We don't need target="_blank" since it's downloading
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  } finally {
    setTimeout(() => {
      window.URL.revokeObjectURL(url);
    }, 30000);
  }
}

export async function exportSalesReportPdfAsync(report, fileName = 'sales-report.pdf') {
  if (!report) return;

  if (Platform.OS !== 'web') {
    if (report.printableHtml) {
      return printAsync({ html: report.printableHtml });
    }
    return;
  }

  // Web: download server-generated PDF directly (no print dialog)
  const { default: api } = await import('../api/config');
  const response = await api.get('/admin/reports/sales/pdf', {
    params: { range: report.range || '30d' },
    responseType: 'blob',
  });

  const blob = new Blob([response.data], { type: 'application/pdf' });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => window.URL.revokeObjectURL(url), 30000);
}
