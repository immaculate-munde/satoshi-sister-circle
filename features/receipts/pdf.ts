import { PDFDocument, type PDFFont, type PDFPage, rgb, StandardFonts } from "pdf-lib";
import type { ReceiptSnapshot } from "../../lib/domain/receipts";
import { formatFiat } from "../../lib/money";
import { BTC_ORANGE, CREAM, DEEP_FOREST, type Prim, RECEIPT_ART } from "./art";
import { ticketLines } from "./format";

const hex = (h: string) => {
  const n = parseInt(h.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};

// Standard PDF fonts only cover WinAnsi. Strip anything else so text never fails to render.
const safe = (s: string) =>
  s
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7E£·]/g, "");

function drawArt(page: PDFPage, prims: Prim[], x: number, y: number, scale: number) {
  for (const p of prims) {
    if (p.kind === "circle") {
      page.drawCircle({
        x: x + p.cx * scale,
        y: y - p.cy * scale,
        size: p.r * scale,
        color: p.fill ? hex(p.fill) : undefined,
        borderColor: p.stroke ? hex(p.stroke) : undefined,
        borderWidth: (p.width ?? 1) * scale,
      });
    } else {
      page.drawSvgPath(p.d, {
        x,
        y,
        scale,
        color: p.fill ? hex(p.fill) : undefined,
        borderColor: p.stroke ? hex(p.stroke) : undefined,
        borderWidth: (p.width ?? 1) * scale,
      });
    }
  }
}

function fitText(text: string, font: PDFFont, size: number, max: number) {
  let t = safe(text);
  while (t.length > 3 && font.widthOfTextAtSize(t, size) > max) t = `${t.slice(0, -4)}...`;
  return t;
}

/** Branded scalloped ticket, rendered server-side from the immutable receipt snapshot. */
export async function renderReceiptPdf(s: ReceiptSnapshot, contentHash: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${s.receiptNumber} - Chama on Lightning receipt`);
  doc.setAuthor("Chama on Lightning");
  doc.setSubject(`${s.kind} receipt`);
  doc.setCreator("Chama on Lightning");
  const W = 360;
  const H = 700;
  const page = doc.addPage([W, H]);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const oblique = await doc.embedFont(StandardFonts.HelveticaBoldOblique);
  const paper = hex("#F7FAF8");
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: paper });

  // Ticket body with scalloped edges (bites punched out in paper colour).
  const tx = 24;
  const ty = 24;
  const tw = W - 48;
  const th = H - 48;
  page.drawRectangle({ x: tx, y: ty, width: tw, height: th, color: hex(DEEP_FOREST) });
  const r = 7;
  for (let yy = ty + 14; yy < ty + th - 6; yy += 22) {
    page.drawCircle({ x: tx, y: yy, size: r, color: paper });
    page.drawCircle({ x: tx + tw, y: yy, size: r, color: paper });
  }
  for (let xx = tx + 14; xx < tx + tw - 6; xx += 22) {
    page.drawCircle({ x: xx, y: ty, size: r, color: paper });
    page.drawCircle({ x: xx, y: ty + th, size: r, color: paper });
  }

  const cream = hex(CREAM);
  const orange = hex(BTC_ORANGE);
  let y = H - 64;
  const tag = s.mode === "DEMO" ? "DEMO - SIMULATED, NO REAL FUNDS" : s.mode === "FLASH_LIVE" ? "LIVE PILOT - REAL FUNDS" : "FLASH TEST NETWORK - TEST FUNDS";
  const tagW = bold.widthOfTextAtSize(tag, 8);
  page.drawRectangle({ x: (W - tagW) / 2 - 8, y: y - 4, width: tagW + 16, height: 16, color: orange });
  page.drawText(tag, { x: (W - tagW) / 2, y, size: 8, font: bold, color: hex(DEEP_FOREST) });
  y -= 20;
  drawArt(page, RECEIPT_ART, (W - 240 * 0.95) / 2, y, 0.95);
  y -= 150 * 0.95 + 26;
  const thanks = "asante sana!";
  page.drawText(thanks, { x: (W - oblique.widthOfTextAtSize(thanks, 24)) / 2, y, size: 24, font: oblique, color: cream });
  y -= 18;
  const kindLabel = s.kind === "PAYOUT" ? "Automatic payout receipt" : s.kind === "DIASPORA" ? "Diaspora contribution receipt" : "Contribution receipt";
  page.drawText(kindLabel, { x: (W - regular.widthOfTextAtSize(kindLabel, 10)) / 2, y, size: 10, font: regular, color: cream });
  y -= 16;

  // perforation
  for (let xx = tx + 16; xx < tx + tw - 16; xx += 8) {
    page.drawLine({ start: { x: xx, y }, end: { x: xx + 4, y }, thickness: 1, color: cream, opacity: 0.6 });
  }
  y -= 18;

  const labelX = tx + 22;
  const valueMax = tw - 44 - 80;
  for (const line of ticketLines(s)) {
    page.drawText(safe(line.label), { x: labelX, y, size: 9, font: regular, color: cream, opacity: 0.75 });
    const v = fitText(line.value, bold, 9.5, valueMax);
    page.drawText(v, { x: tx + tw - 22 - bold.widthOfTextAtSize(v, 9.5), y, size: 9.5, font: bold, color: cream });
    y -= 17;
  }
  y -= 4;
  for (let xx = tx + 16; xx < tx + tw - 16; xx += 8) {
    page.drawLine({ start: { x: xx, y }, end: { x: xx + 4, y }, thickness: 1, color: cream, opacity: 0.6 });
  }
  y -= 30;
  const total = `TOTAL: ${formatFiat(BigInt(s.totalKesMinor), "KES")}`;
  page.drawText(total, { x: (W - bold.widthOfTextAtSize(total, 22)) / 2, y, size: 22, font: bold, color: orange });
  y -= 22;
  if (s.diaspora) {
    const b = s.diaspora.benchmark;
    const text = `Historical UK-Kenya remittance cost on this amount: ${formatFiat(BigInt(b.lowMinor), "GBP", { cents: true })} to ${formatFiat(BigInt(b.highMinor), "GBP", { cents: true })} (3.4%-4.4%, World Bank 2025). Not a live quote.`;
    for (const chunk of wrap(safe(text), regular, 7.5, tw - 44)) {
      page.drawText(chunk, { x: labelX, y, size: 7.5, font: regular, color: cream, opacity: 0.85 });
      y -= 10;
    }
  }
  const foot = `Integrity hash ${contentHash.slice(0, 16)}...  KES amounts are display values; settlement is in ${s.principal.asset === "BTC_SAT" ? "sats" : "Flash USD-stable cents"}.`;
  for (const chunk of wrap(safe(foot), regular, 6.5, tw - 44)) {
    page.drawText(chunk, { x: labelX, y: Math.max(y, ty + 14), size: 6.5, font: regular, color: cream, opacity: 0.7 });
    y -= 9;
  }
  return doc.save();
}

function wrap(text: string, font: PDFFont, size: number, max: number): string[] {
  const words = text.split(" ");
  const out: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) > max && cur) {
      out.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) out.push(cur);
  return out;
}
