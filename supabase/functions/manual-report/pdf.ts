import PDFDocument from "pdfkit";
import type { ReportModel } from "./report.ts";

const ARABIC_FONT_URL =
  "https://cdn.jsdelivr.net/gh/google/fonts@35ddfc50b8c0dda6a1e0eb5d48d962c26a2ec5ff/ofl/notonaskharabic/NotoNaskhArabic%5Bwght%5D.ttf";

let cachedFont: Promise<Uint8Array> | undefined;

async function loadArabicFont(): Promise<Uint8Array> {
  cachedFont ??= fetch(ARABIC_FONT_URL).then(async (response) => {
    if (!response.ok) throw new Error(`Arabic font download failed (${response.status})`);
    return new Uint8Array(await response.arrayBuffer());
  });
  return cachedFont;
}

function safeText(value: unknown): string {
  return String(value ?? "—").replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, 600);
}

export async function renderArabicPdf(
  model: ReportModel,
  suppliedFont?: Uint8Array,
): Promise<Uint8Array> {
  const font = suppliedFont ?? await loadArabicFont();
  const doc = new PDFDocument({
    size: "A4",
    margin: 42,
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
  doc.fontSize(20).text(model.generatedTitle, { align: "right", features: ["rtla"] });
  doc.moveDown(0.3);
  doc.fontSize(11).fillColor("#4b5563").text(`التاريخ: ${safeText(model.reportDate)}`, {
    align: "right",
    features: ["rtla"],
  });
  doc.moveDown(0.8);

  for (const [index, row] of model.rows.entries()) {
    if (doc.y > 700) doc.addPage();
    doc.fillColor("#111827").fontSize(13).text(
      `${index + 1}. معاملة رقم ${safeText(row.transaction_no)} — ${safeText(row.status)}`,
      { align: "right", features: ["rtla"] },
    );
    doc.fontSize(10.5).fillColor("#374151");
    doc.text(`الموضوع: ${safeText(row.subject)}`, { align: "right", features: ["rtla"] });
    doc.text(`الجهة: ${safeText(row.entity)}`, { align: "right", features: ["rtla"] });
    doc.text(`الإجراء المطلوب: ${safeText(row.required_action)}`, { align: "right", features: ["rtla"] });
    if (row.notes) {
      doc.text(`ملاحظات: ${safeText(row.notes)}`, { align: "right", features: ["rtla"] });
    }
    doc.moveDown(0.6);
    doc.strokeColor("#d1d5db").moveTo(42, doc.y).lineTo(553, doc.y).stroke();
    doc.moveDown(0.6);
  }

  doc.end();
  return await completed;
}
