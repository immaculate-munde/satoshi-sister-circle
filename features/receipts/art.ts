/**
 * PLACEHOLDER brand artwork, drawn in-repo because the original Figma exports (wing + coin logo,
 * receipt illustration of three women around a basket) could not be exported in this session.
 * Replace with the original assets from Figma file eTSzwsezboz0KoVJrbifAI (see public/brand/README.md).
 * Shared by the React ticket and the PDF renderer so both stay identical.
 */
export type Prim =
  | { kind: "path"; d: string; stroke?: string; fill?: string; width?: number }
  | { kind: "circle"; cx: number; cy: number; r: number; stroke?: string; fill?: string; width?: number };

export const CREAM = "#FDE8F2";
export const BTC_ORANGE = "#FE6F01";
export const DEEP_FOREST = "#21212E";
export const MONEY_GREEN = "#F74A9A";

/** viewBox 0 0 240 150 */
export const RECEIPT_ART: Prim[] = [
  // ground line
  { kind: "path", d: "M14 140 Q120 132 226 140", stroke: CREAM, width: 1.6 },
  // left woman: headwrap, head, shoulders/dress, arm to basket
  { kind: "path", d: "M38 42 Q50 26 64 40 Q60 34 52 34 Q44 34 38 42 Z", stroke: CREAM, fill: CREAM, width: 1.2 },
  { kind: "circle", cx: 51, cy: 52, r: 10, stroke: CREAM, width: 1.8 },
  { kind: "path", d: "M30 140 Q28 92 42 72 Q51 64 60 72 Q74 92 72 140", stroke: CREAM, width: 1.8 },
  { kind: "path", d: "M60 80 Q76 96 92 104", stroke: CREAM, width: 1.8 },
  { kind: "path", d: "M40 96 Q51 102 64 96", stroke: CREAM, width: 1.2 },
  // middle woman (taller, behind basket)
  { kind: "path", d: "M106 24 Q120 6 136 22 Q130 15 121 15 Q112 15 106 24 Z", stroke: CREAM, fill: CREAM, width: 1.2 },
  { kind: "circle", cx: 121, cy: 34, r: 10.5, stroke: CREAM, width: 1.8 },
  { kind: "path", d: "M100 96 Q102 66 112 54 Q121 47 130 54 Q140 66 142 96", stroke: CREAM, width: 1.8 },
  { kind: "path", d: "M108 66 Q100 82 104 98", stroke: CREAM, width: 1.8 },
  { kind: "path", d: "M134 66 Q142 82 138 98", stroke: CREAM, width: 1.8 },
  // right woman
  { kind: "path", d: "M176 42 Q188 26 202 40 Q198 34 190 34 Q182 34 176 42 Z", stroke: CREAM, fill: CREAM, width: 1.2 },
  { kind: "circle", cx: 189, cy: 52, r: 10, stroke: CREAM, width: 1.8 },
  { kind: "path", d: "M168 140 Q166 92 180 72 Q189 64 198 72 Q212 92 210 140", stroke: CREAM, width: 1.8 },
  { kind: "path", d: "M180 80 Q164 96 148 104", stroke: CREAM, width: 1.8 },
  { kind: "path", d: "M176 96 Q189 102 202 96", stroke: CREAM, width: 1.2 },
  // basket
  { kind: "path", d: "M84 100 L156 100 L146 134 Q120 140 94 134 Z", stroke: CREAM, width: 2 },
  { kind: "path", d: "M88 112 L152 112", stroke: CREAM, width: 1.2 },
  { kind: "path", d: "M91 123 L149 123", stroke: CREAM, width: 1.2 },
  { kind: "path", d: "M104 100 L106 136 M120 100 L120 138 M136 100 L134 136", stroke: CREAM, width: 1.2 },
  { kind: "path", d: "M88 100 Q120 76 152 100", stroke: CREAM, width: 1.6 },
  // Lightning coin rising from the basket
  { kind: "circle", cx: 120, cy: 84, r: 13, fill: BTC_ORANGE, stroke: BTC_ORANGE, width: 1 },
  { kind: "path", d: "M122 74 L114 86 L120 86 L117 95 L126 82 L120 82 Z", fill: DEEP_FOREST, stroke: DEEP_FOREST, width: 0.6 },
];

/** viewBox 0 0 120 80: a wing lifting a Lightning coin. */
export const LOGO_ART: Prim[] = [
  { kind: "path", d: "M50 46 Q34 18 6 14 Q18 22 20 30 Q8 28 2 32 Q16 36 22 42 Q10 44 6 50 Q24 52 36 54 Q46 54 50 46 Z", fill: MONEY_GREEN, stroke: MONEY_GREEN, width: 1 },
  { kind: "path", d: "M44 46 Q32 30 16 24", stroke: "#FDE8F2", width: 1.6 },
  { kind: "path", d: "M42 50 Q28 42 14 40", stroke: "#FDE8F2", width: 1.6 },
  { kind: "circle", cx: 76, cy: 40, r: 28, fill: BTC_ORANGE, stroke: BTC_ORANGE, width: 1 },
  { kind: "circle", cx: 76, cy: 40, r: 22, stroke: "#FFFFFF", width: 2 },
  { kind: "path", d: "M80 22 L66 44 L76 44 L72 58 L88 36 L78 36 Z", fill: "#FFFFFF", stroke: "#FFFFFF", width: 1 },
];
