/** Writes the placeholder brand SVGs into public/. Replace with original Figma exports when available. */
import fs from "node:fs";
import path from "node:path";
import { LOGO_ART, type Prim, RECEIPT_ART } from "../features/receipts/art";

function svg(prims: Prim[], viewBox: string, bg?: string) {
  const [, , w, h] = viewBox.split(" ").map(Number);
  const body = prims
    .map((p) =>
      p.kind === "circle"
        ? `<circle cx="${p.cx}" cy="${p.cy}" r="${p.r}" fill="${p.fill ?? "none"}" stroke="${p.stroke ?? "none"}" stroke-width="${p.width ?? 1}"/>`
        : `<path d="${p.d}" fill="${p.fill ?? "none"}" stroke="${p.stroke ?? "none"}" stroke-width="${p.width ?? 1}" stroke-linecap="round" stroke-linejoin="round"/>`,
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${bg ? `<rect width="${w}" height="${h}" fill="${bg}"/>` : ""}${body}</svg>\n`;
}

const out = path.join(process.cwd(), "public");
fs.mkdirSync(path.join(out, "brand"), { recursive: true });
fs.writeFileSync(path.join(out, "brand", "logo.svg"), svg(LOGO_ART, "0 0 120 80"));
fs.writeFileSync(path.join(out, "brand", "receipt-art.svg"), svg(RECEIPT_ART, "0 0 240 150", "#21212E"));
// App icons: logo on a soft paper square (maskable keeps the art inside the safe zone).
const logoBody = svg(LOGO_ART, "0 0 120 80").replace(/^<svg[^>]*>|<\/svg>\n$/g, "");
const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><rect width="160" height="160" rx="36" fill="#FFF7FB"/><g transform="translate(20 40)">${logoBody}</g></svg>\n`;
fs.writeFileSync(path.join(out, "icon.svg"), icon);
fs.writeFileSync(path.join(process.cwd(), "app", "icon.svg"), icon);
fs.writeFileSync(
  path.join(out, "icon-maskable.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><rect width="160" height="160" fill="#FDE8F2"/><g transform="translate(35 50) scale(0.75)">${logoBody}</g></svg>\n`,
);
console.log("Wrote public/brand/logo.svg, public/brand/receipt-art.svg, public/icon.svg, public/icon-maskable.svg");
