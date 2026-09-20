import PDFDocument from "pdfkit";
import type { ReportModel, ReportRow } from "./report.ts";

const ARABIC_FONT_URL =
  "https://cdn.jsdelivr.net/gh/google/fonts@35ddfc50b8c0dda6a1e0eb5d48d962c26a2ec5ff/ofl/notonaskharabic/NotoNaskhArabic%5Bwght%5D.ttf";

const COLORS = {
  background: "#F7F2E9",
  surface: "#FBF7EF",
  white: "#FFFFFF",
  ink: "#17231F",
  muted: "#69736E",
  line: "#D9D0C4",
  green: "#155D47",
  deepGreen: "#0B352B",
  gold: "#C7A24A",
  blue: "#2467B5",
  under: "#157A54",
  yellow: "#EFC21B",
  orange: "#E96F13",
  red: "#C93434",
};

const PAGE = {
  width: 841.89,
  height: 595.28,
  x: 30,
  contentWidth: 781.89,
  tableTop: 188,
  tableBottom: 538,
};

const TABLE_COLUMNS = [
  { key: "action", label: "الإجراء المطلوب", width: 135 },
  { key: "waiting", label: "أيام العمل", width: 60 },
  { key: "status", label: "الحالة", width: 78 },
  { key: "date", label: "تاريخ القيد", width: 85 },
  { key: "entity", label: "الجهة", width: 105 },
  { key: "subject", label: "الموضوع", width: 145 },
  { key: "type", label: "النوع", width: 55 },
  { key: "number", label: "رقم المعاملة", width: 90 },
  { key: "index", label: "م", width: 28 },
] as const;

let cachedFont: Promise<Uint8Array> | undefined;

async function loadArabicFont(): Promise<Uint8Array> {
  cachedFont ??= fetch(ARABIC_FONT_URL).then(async (response) => {
    if (!response.ok) throw new Error(`Arabic font download failed (${response.status})`);
    return new Uint8Array(await response.arrayBuffer());
  });
  return cachedFont;
}

function safeText(value: unknown): string {
  return String(value ?? "—").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 800) || "—";
}

function hasArabic(value: string): boolean {
  return /[\u0600-\u06ff]/.test(value);
}

function textOptions(value: string) {
  return hasArabic(value) ? { features: ["rtla"] } : {};
}

function fitTextSize(
  doc: PDFKit.PDFDocument,
  value: string,
  width: number,
  preferred: number,
  minimum: number,
): number {
  let size = preferred;
  while (size > minimum) {
    doc.fontSize(size);
    if (doc.widthOfString(value, textOptions(value)) <= width) break;
    size -= 0.25;
  }
  return size;
}

function ellipsize(doc: PDFKit.PDFDocument, value: unknown, width: number, size: number): string {
  const text = safeText(value);
  doc.fontSize(size);
  if (doc.widthOfString(text, textOptions(text)) <= width) return text;
  let result = text;
  while (result.length > 1 && doc.widthOfString(`${result}…`, textOptions(result)) > width) {
    result = result.slice(0, -1);
  }
  return `${result.trim()}…`;
}

function drawSingleLine(
  doc: PDFKit.PDFDocument,
  value: unknown,
  x: number,
  y: number,
  width: number,
  height: number,
  options: {
    align?: "left" | "center" | "right";
    color?: string;
    preferredSize?: number;
    minimumSize?: number;
  } = {},
) {
  const text = safeText(value);
  const preferred = options.preferredSize ?? 8.2;
  const minimum = options.minimumSize ?? 6.2;
  const size = fitTextSize(doc, text, width - 8, preferred, minimum);
  const fitted = ellipsize(doc, text, width - 8, size);
  const textHeight = doc.heightOfString(fitted, { width: width - 8, lineBreak: false });
  doc
    .fillColor(options.color ?? COLORS.ink)
    .fontSize(size)
    .text(fitted, x + 4, y + Math.max(1, (height - textHeight) / 2), {
      width: width - 8,
      height,
      align: options.align ?? "center",
      lineBreak: false,
      ...textOptions(fitted),
    });
}

function statusStyle(status: string): { background: string; foreground: string } {
  return {
    "قيد الإجراء": { background: COLORS.blue, foreground: COLORS.white },
    "تحت الإجراء": { background: COLORS.under, foreground: COLORS.white },
    "بانتظار رد": { background: COLORS.yellow, foreground: "#312800" },
    "تحتاج إلحاقي": { background: COLORS.orange, foreground: COLORS.white },
    "متأخرة": { background: COLORS.red, foreground: COLORS.white },
  }[status] ?? { background: COLORS.muted, foreground: COLORS.white };
}

function drawPageBackground(doc: PDFKit.PDFDocument) {
  doc.save().rect(0, 0, PAGE.width, PAGE.height).fill(COLORS.background).restore();
  doc
    .save()
    .roundedRect(18, 18, PAGE.width - 36, PAGE.height - 36, 12)
    .lineWidth(0.8)
    .strokeColor(COLORS.line)
    .stroke()
    .restore();
}

function drawMetadataCell(
  doc: PDFKit.PDFDocument,
  x: number,
  width: number,
  label: string,
  value: string,
) {
  const y = 96;
  doc.roundedRect(x, y, width, 28, 6).fill(COLORS.surface).strokeColor(COLORS.line).stroke();
  drawSingleLine(doc, label, x + width - 56, y, 52, 28, {
    align: "right",
    color: COLORS.muted,
    preferredSize: 8,
  });
  drawSingleLine(doc, value, x + 5, y, width - 62, 28, {
    align: "center",
    color: COLORS.ink,
    preferredSize: 9,
  });
}

function drawSummary(doc: PDFKit.PDFDocument, model: ReportModel) {
  const cards = [
    { label: "متأخرة", value: model.summary.late, color: COLORS.red },
    { label: "تحتاج إلحاقي", value: model.summary.follow, color: COLORS.orange },
    { label: "بانتظار رد", value: model.summary.wait, color: COLORS.yellow },
    { label: "قيد / تحت الإجراء", value: model.summary.progress, color: COLORS.blue },
    { label: "إجمالي المفتوحة", value: model.summary.open, color: COLORS.green },
  ];
  const gap = 8;
  const width = (PAGE.contentWidth - gap * (cards.length - 1)) / cards.length;
  cards.forEach((card, index) => {
    const x = PAGE.x + index * (width + gap);
    doc.roundedRect(x, 134, width, 40, 7).fill(COLORS.surface).strokeColor(COLORS.line).stroke();
    doc.roundedRect(x + width - 7, 134, 7, 40, 4).fill(card.color);
    drawSingleLine(doc, String(card.value), x + 10, 137, 36, 32, {
      align: "center",
      color: COLORS.ink,
      preferredSize: 15,
      minimumSize: 13,
    });
    drawSingleLine(doc, card.label, x + 48, 137, width - 59, 32, {
      align: "right",
      color: COLORS.muted,
      preferredSize: 8.5,
    });
  });
}

function drawReportHeader(doc: PDFKit.PDFDocument, model: ReportModel) {
  drawPageBackground(doc);
  doc.roundedRect(PAGE.x, 28, PAGE.contentWidth, 56, 10).fill(COLORS.deepGreen);
  doc.rect(PAGE.x, 82, PAGE.contentWidth, 3).fill(COLORS.gold);

  doc.roundedRect(PAGE.x + 12, 42, 88, 28, 8).fill(COLORS.gold);
  drawSingleLine(doc, "تقرير يومي", PAGE.x + 12, 42, 88, 28, {
    color: COLORS.deepGreen,
    preferredSize: 9.5,
    minimumSize: 8,
  });
  drawSingleLine(doc, model.generatedTitle, PAGE.x + 112, 36, PAGE.contentWidth - 236, 40, {
    color: COLORS.white,
    preferredSize: 18,
    minimumSize: 14,
  });
  drawSingleLine(doc, "قسم الشؤون القانونية", PAGE.width - 180, 38, 132, 20, {
    align: "right",
    color: COLORS.white,
    preferredSize: 9,
  });
  drawSingleLine(doc, "متابعة الأعمال", PAGE.width - 180, 57, 132, 14, {
    align: "right",
    color: "#DCE9E4",
    preferredSize: 7.5,
  });

  const metadataGap = 8;
  const metadataWidth = (PAGE.contentWidth - metadataGap * 3) / 4;
  const metadata = [
    ["الوقت", model.generatedAt.time],
    ["الميلادي", model.generatedAt.gregorianDate],
    ["الهجري", model.generatedAt.hijriDate],
    ["اليوم", model.generatedAt.dayName],
  ];
  metadata.forEach(([label, value], index) => {
    drawMetadataCell(doc, PAGE.x + index * (metadataWidth + metadataGap), metadataWidth, label, value);
  });
  drawSummary(doc, model);
}

function drawTableHeader(doc: PDFKit.PDFDocument) {
  let x = PAGE.x;
  for (const column of TABLE_COLUMNS) {
    doc.rect(x, PAGE.tableTop, column.width, 27).fill(COLORS.green).strokeColor(COLORS.background).stroke();
    drawSingleLine(doc, column.label, x, PAGE.tableTop, column.width, 27, {
      color: COLORS.white,
      preferredSize: 8.3,
      minimumSize: 7,
    });
    x += column.width;
  }
}

function drawTrackingLine(doc: PDFKit.PDFDocument, row: ReportRow, y: number) {
  const segments = [
    { label: "الجهة المرسل إليها", value: row.sent_to ?? "—", width: 360 },
    { label: "تاريخ الإرسال", value: row.sentDateHijri ?? "—", width: 220 },
    { label: "رقم الخطاب", value: row.outgoing_letter_no ?? "—", width: 201.89 },
  ];
  let x = PAGE.x;
  doc.rect(PAGE.x, y, PAGE.contentWidth, 18).fill("#EEF3F0").strokeColor(COLORS.line).stroke();
  for (const segment of segments) {
    const labelWidth = Math.min(92, segment.width * 0.42);
    drawSingleLine(doc, segment.value, x + 4, y, segment.width - labelWidth - 8, 18, {
      align: "right",
      preferredSize: 7.4,
      minimumSize: 6.2,
    });
    drawSingleLine(doc, segment.label, x + segment.width - labelWidth, y, labelWidth - 4, 18, {
      align: "right",
      color: COLORS.green,
      preferredSize: 7.1,
      minimumSize: 6.2,
    });
    x += segment.width;
  }
}

function drawNotesLine(doc: PDFKit.PDFDocument, row: ReportRow, y: number) {
  doc.rect(PAGE.x, y, PAGE.contentWidth, 18).fill(COLORS.surface).strokeColor(COLORS.line).stroke();
  drawSingleLine(doc, row.notes ?? "—", PAGE.x + 7, y, PAGE.contentWidth - 83, 18, {
    align: "right",
    preferredSize: 7.4,
    minimumSize: 6.2,
  });
  drawSingleLine(doc, "ملاحظات", PAGE.x + PAGE.contentWidth - 72, y, 66, 18, {
    align: "right",
    color: COLORS.green,
    preferredSize: 7.3,
  });
}

function drawMainRow(doc: PDFKit.PDFDocument, row: ReportRow, index: number, y: number) {
  const height = 34;
  const values: Record<string, unknown> = {
    action: row.required_action,
    waiting: row.waitingDays ?? "—",
    status: row.status,
    date: row.entryDateHijri,
    entity: row.entity,
    subject: row.subject,
    type: row.transaction_type ?? "—",
    number: row.transaction_no,
    index: index + 1,
  };
  let x = PAGE.x;
  for (const column of TABLE_COLUMNS) {
    doc
      .rect(x, y, column.width, height)
      .fill(index % 2 === 0 ? COLORS.white : COLORS.surface)
      .strokeColor(COLORS.line)
      .stroke();
    if (column.key === "status") {
      const style = statusStyle(row.status);
      doc.roundedRect(x + 5, y + 7, column.width - 10, height - 14, 6).fill(style.background);
      drawSingleLine(doc, row.status, x + 5, y + 7, column.width - 10, height - 14, {
        color: style.foreground,
        preferredSize: 7.4,
        minimumSize: 6.4,
      });
    } else {
      drawSingleLine(doc, values[column.key], x, y, column.width, height, {
        align: ["action", "entity", "subject"].includes(column.key) ? "right" : "center",
        preferredSize: column.key === "number" ? 8.4 : 7.8,
        minimumSize: 6.2,
      });
    }
    x += column.width;
  }
}

function rowHeight(row: ReportRow): number {
  const hasTracking = Boolean(row.sent_date || row.sent_to || row.outgoing_letter_no);
  return 34 + (hasTracking ? 18 : 0) + 18;
}

function drawRow(doc: PDFKit.PDFDocument, row: ReportRow, index: number, y: number): number {
  drawMainRow(doc, row, index, y);
  let cursor = y + 34;
  if (row.sent_date || row.sent_to || row.outgoing_letter_no) {
    drawTrackingLine(doc, row, cursor);
    cursor += 18;
  }
  drawNotesLine(doc, row, cursor);
  return cursor + 18;
}

function drawFooter(doc: PDFKit.PDFDocument, pageNumber: number, pageCount: number) {
  doc.moveTo(PAGE.x, 548).lineTo(PAGE.x + PAGE.contentWidth, 548).lineWidth(0.8).strokeColor(COLORS.gold).stroke();
  drawSingleLine(
    doc,
    "ملاحظة: يعرض التقرير المعاملات غير المنتهية وقت إنشائه وفق آخر تحديث مسجل في النظام.",
    PAGE.x + 88,
    550,
    PAGE.contentWidth - 176,
    16,
    { color: COLORS.muted, preferredSize: 7.2, minimumSize: 6.4 },
  );
  drawSingleLine(doc, `${pageNumber} / ${pageCount}`, PAGE.x, 568, PAGE.contentWidth, 12, {
    color: COLORS.muted,
    preferredSize: 7,
  });
}

export async function renderArabicPdf(
  model: ReportModel,
  suppliedFont?: Uint8Array,
): Promise<Uint8Array> {
  const font = suppliedFont ?? await loadArabicFont();
  const doc = new PDFDocument({
    size: "A4",
    layout: "landscape",
    margin: 0,
    bufferPages: true,
    info: { Title: model.generatedTitle },
  });
  const chunks: Uint8Array[] = [];
  doc.on("data", (chunk: Uint8Array) => chunks.push(new Uint8Array(chunk)));
  const completed = new Promise<Uint8Array>((resolve, reject) => {
    doc.on("end", () => {
      const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const output = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) {
        output.set(chunk, offset);
        offset += chunk.length;
      }
      resolve(output);
    });
    doc.on("error", reject);
  });

  doc.registerFont("Arabic", font);
  doc.font("Arabic");
  drawReportHeader(doc, model);
  drawTableHeader(doc);

  let y = PAGE.tableTop + 27;
  model.rows.forEach((row, index) => {
    if (y + rowHeight(row) > PAGE.tableBottom) {
      doc.addPage({ size: "A4", layout: "landscape", margin: 0 });
      doc.font("Arabic");
      drawReportHeader(doc, model);
      drawTableHeader(doc);
      y = PAGE.tableTop + 27;
    }
    y = drawRow(doc, row, index, y);
  });

  const pageRange = doc.bufferedPageRange();
  for (let page = 0; page < pageRange.count; page += 1) {
    doc.switchToPage(pageRange.start + page);
    doc.font("Arabic");
    drawFooter(doc, page + 1, pageRange.count);
  }

  doc.end();
  return await completed;
}
