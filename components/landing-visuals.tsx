/** Flat-vector landing art — three women + basket, matching the Chama hero reference. */

import type { ReactNode } from "react";

const LINE = "#21212E";
const GREEN = "#F74A9A";
const FOREST = "#21212E";
const GOLD = "#FE6F01";
const ORANGE = "#FE6F01";
const SKIN = "#C47A4A";
const SKIN2 = "#D4956A";
const SKIN3 = "#B86B3C";

/** Hero illustration: three women holding a shared basket (flat vector, bold outlines). */
export function LandingHeroPeople({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 560 480" className={className} role="img" aria-label="Three women holding a shared savings basket with Lightning">
      <defs>
        <filter id="cardShadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="8" stdDeviation="10" floodColor="#21212E" floodOpacity="0.12" />
        </filter>
      </defs>

      {/* unity ring */}
      <circle cx="280" cy="230" r="200" fill="none" stroke="#F3D0E2" strokeWidth="3" strokeDasharray="8 12" />
      <circle cx="280" cy="230" r="168" fill="#FFF7FB" />

      {/* LEFT woman — green dress, headwrap */}
      <g stroke={LINE} strokeWidth="3" strokeLinejoin="round">
        {/* headwrap */}
        <path d="M118 118 Q148 78 178 118 Q168 98 148 96 Q128 98 118 118 Z" fill={GREEN} />
        <path d="M128 108 Q148 92 168 108" fill="none" stroke={FOREST} strokeWidth="2" />
        {/* head */}
        <circle cx="148" cy="132" r="28" fill={SKIN} />
        <circle cx="138" cy="128" r="2.5" fill={FOREST} stroke="none" />
        <circle cx="158" cy="128" r="2.5" fill={FOREST} stroke="none" />
        <path d="M140 142 Q148 148 156 142" fill="none" stroke={FOREST} strokeWidth="2.2" strokeLinecap="round" />
        {/* neck */}
        <path d="M140 156 L156 156 L154 170 L142 170 Z" fill={SKIN} />
        {/* body */}
        <path d="M108 172 Q148 158 188 172 L198 300 Q148 318 98 300 Z" fill={GREEN} />
        {/* arm to basket */}
        <path d="M180 200 Q220 230 248 262" fill="none" stroke={SKIN} strokeWidth="14" strokeLinecap="round" />
        <path d="M180 200 Q220 230 248 262" fill="none" stroke={LINE} strokeWidth="3" strokeLinecap="round" />
        {/* outer arm */}
        <path d="M118 198 Q96 240 108 278" fill="none" stroke={SKIN} strokeWidth="14" strokeLinecap="round" />
        <path d="M118 198 Q96 240 108 278" fill="none" stroke={LINE} strokeWidth="3" strokeLinecap="round" />
      </g>

      {/* RIGHT woman — gold dress */}
      <g stroke={LINE} strokeWidth="3" strokeLinejoin="round">
        <path d="M382 118 Q412 78 442 118 Q432 98 412 96 Q392 98 382 118 Z" fill={GOLD} />
        <circle cx="412" cy="132" r="28" fill={SKIN2} />
        <circle cx="402" cy="128" r="2.5" fill={FOREST} stroke="none" />
        <circle cx="422" cy="128" r="2.5" fill={FOREST} stroke="none" />
        <path d="M404 142 Q412 148 420 142" fill="none" stroke={FOREST} strokeWidth="2.2" strokeLinecap="round" />
        <path d="M404 156 L420 156 L418 170 L406 170 Z" fill={SKIN2} />
        <path d="M372 172 Q412 158 452 172 L462 300 Q412 318 362 300 Z" fill={GOLD} />
        <path d="M380 200 Q340 230 312 262" fill="none" stroke={SKIN2} strokeWidth="14" strokeLinecap="round" />
        <path d="M380 200 Q340 230 312 262" fill="none" stroke={LINE} strokeWidth="3" strokeLinecap="round" />
        <path d="M442 198 Q464 240 452 278" fill="none" stroke={SKIN2} strokeWidth="14" strokeLinecap="round" />
        <path d="M442 198 Q464 240 452 278" fill="none" stroke={LINE} strokeWidth="3" strokeLinecap="round" />
      </g>

      {/* CENTER woman — taller, lightning dress */}
      <g stroke={LINE} strokeWidth="3" strokeLinejoin="round">
        {/* hair/braids bun */}
        <circle cx="280" cy="78" r="18" fill={FOREST} stroke={LINE} />
        <path d="M248 108 Q280 70 312 108 Q300 92 280 90 Q260 92 248 108 Z" fill={FOREST} />
        <circle cx="280" cy="118" r="30" fill={SKIN3} />
        <circle cx="268" cy="114" r="2.5" fill={FOREST} stroke="none" />
        <circle cx="292" cy="114" r="2.5" fill={FOREST} stroke="none" />
        <path d="M270 128 Q280 134 290 128" fill="none" stroke={FOREST} strokeWidth="2.2" strokeLinecap="round" />
        <path d="M272 144 L288 144 L286 160 L274 160 Z" fill={SKIN3} />
        {/* dress */}
        <path d="M232 162 Q280 146 328 162 L340 290 Q280 312 220 290 Z" fill={GREEN} />
        {/* lightning on dress */}
        <path d="M292 178 L262 218 H280 L268 252 L302 206 H282 Z" fill={GOLD} stroke={LINE} strokeWidth="2.5" />
        {/* arms holding basket rim */}
        <path d="M244 190 Q250 230 268 268" fill="none" stroke={SKIN3} strokeWidth="14" strokeLinecap="round" />
        <path d="M244 190 Q250 230 268 268" fill="none" stroke={LINE} strokeWidth="3" strokeLinecap="round" />
        <path d="M316 190 Q310 230 292 268" fill="none" stroke={SKIN3} strokeWidth="14" strokeLinecap="round" />
        <path d="M316 190 Q310 230 292 268" fill="none" stroke={LINE} strokeWidth="3" strokeLinecap="round" />
      </g>

      {/* Basket */}
      <g stroke={LINE} strokeWidth="3" strokeLinejoin="round">
        <path d="M208 270 L352 270 L338 348 Q280 368 222 348 Z" fill="#E8C9A0" />
        <path d="M214 270 Q280 236 346 270" fill="#F3D7B0" />
        {/* weave */}
        <path d="M218 292 H342 M222 312 H338 M226 332 H334" fill="none" stroke={FOREST} strokeWidth="2" opacity="0.45" />
        <path d="M240 270 V350 M280 262 V358 M320 270 V350" fill="none" stroke={FOREST} strokeWidth="2" opacity="0.35" />
        {/* Lightning coin in basket */}
        <circle cx="280" cy="258" r="22" fill={ORANGE} stroke={LINE} strokeWidth="3" />
        <path d="M288 242 L268 262 H278 L272 276 L292 254 H280 Z" fill="#fff" stroke="none" />
      </g>
    </svg>
  );
}

/** Floating status chips around the hero art (HTML overlay uses these labels). */
export const HERO_CHIPS = [
  { id: "paid", tone: "ok" as const },
  { id: "payout", tone: "warn" as const },
  { id: "round", tone: "ok" as const },
];

function FeatureFrame({ children, bg }: { children: ReactNode; bg: string }) {
  return (
    <svg viewBox="0 0 88 88" className="h-14 w-14" aria-hidden>
      <rect x="4" y="4" width="80" height="80" rx="22" fill={bg} />
      {children}
    </svg>
  );
}

export function FeatureIconLedger() {
  return (
    <FeatureFrame bg="#FDE8F2">
      <rect x="28" y="24" width="32" height="42" rx="8" fill="#fff" stroke={LINE} strokeWidth="2.5" />
      <circle cx="44" cy="38" r="7" fill={SKIN} stroke={LINE} strokeWidth="2" />
      <path d="M34 52h20M34 60h14" stroke={GREEN} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="58" cy="62" r="9" fill={ORANGE} stroke={LINE} strokeWidth="2" />
      <path d="M61 56 L55 63 H59 L56 69 L64 61 H59 Z" fill="#fff" stroke="none" />
    </FeatureFrame>
  );
}

export function FeatureIconPayout() {
  return (
    <FeatureFrame bg="#FFF1E4">
      <circle cx="44" cy="34" r="11" fill={SKIN2} stroke={LINE} strokeWidth="2.5" />
      <path d="M30 52 Q44 44 58 52 L56 70 Q44 76 32 70 Z" fill={GREEN} stroke={LINE} strokeWidth="2.5" />
      <path d="M44 48v20M36 60l8 10 8-10" stroke={GOLD} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </FeatureFrame>
  );
}

export function FeatureIconLightning() {
  return (
    <FeatureFrame bg="#FDE8F2">
      <circle cx="32" cy="36" r="9" fill={SKIN} stroke={LINE} strokeWidth="2" />
      <circle cx="56" cy="36" r="9" fill={SKIN2} stroke={LINE} strokeWidth="2" />
      <path d="M22 48 Q32 42 42 48" fill={GREEN} stroke={LINE} strokeWidth="2" />
      <path d="M46 48 Q56 42 66 48" fill={GOLD} stroke={LINE} strokeWidth="2" />
      <circle cx="44" cy="60" r="14" fill={ORANGE} stroke={LINE} strokeWidth="2.5" />
      <path d="M48 50 L38 61 H44 L40 70 L52 57 H45 Z" fill="#fff" stroke="none" />
    </FeatureFrame>
  );
}

export function FeatureIconAbroad() {
  return (
    <FeatureFrame bg="#FDE8F2">
      <circle cx="44" cy="44" r="22" fill="#fff" stroke={LINE} strokeWidth="2.5" />
      <ellipse cx="44" cy="44" rx="9" ry="22" fill="none" stroke={GREEN} strokeWidth="2" />
      <path d="M22 44h44M26 34h36M26 54h36" stroke={GREEN} strokeWidth="2" strokeLinecap="round" />
      <circle cx="58" cy="30" r="9" fill={SKIN2} stroke={LINE} strokeWidth="2" />
    </FeatureFrame>
  );
}
