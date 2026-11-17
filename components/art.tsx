import { LOGO_ART, type Prim, RECEIPT_ART } from "@/features/receipts/art";

function Prims({ prims }: { prims: Prim[] }) {
  return (
    <>
      {prims.map((p, i) =>
        p.kind === "circle" ? (
          <circle
            key={i}
            cx={p.cx}
            cy={p.cy}
            r={p.r}
            fill={p.fill ?? "none"}
            stroke={p.stroke ?? "none"}
            strokeWidth={p.width ?? 1}
          />
        ) : (
          <path
            key={i}
            d={p.d}
            fill={p.fill ?? "none"}
            stroke={p.stroke ?? "none"}
            strokeWidth={p.width ?? 1}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ),
      )}
    </>
  );
}

/** Wing + Lightning coin. Placeholder until the original Figma export lands in public/brand. */
export function Logo({ size = 96, title = "Chama on Lightning" }: { size?: number; title?: string }) {
  return (
    <svg width={size} height={(size * 80) / 120} viewBox="0 0 120 80" role="img" aria-label={title}>
      <Prims prims={LOGO_ART} />
    </svg>
  );
}

export function ReceiptArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 150" className={className} role="img" aria-label="Three women around a basket with a Lightning coin">
      <Prims prims={RECEIPT_ART} />
    </svg>
  );
}

/** Three-member circle for onboarding. */
export function CircleArt({ className }: { className?: string }) {
  const people = [
    { x: 60, y: 46, c: "#0F6B4C" },
    { x: 140, y: 46, c: "#FF9F1C" },
    { x: 100, y: 118, c: "#0A3D2E" },
  ];
  return (
    <svg viewBox="0 0 200 170" className={className} aria-hidden="true">
      <circle cx="100" cy="80" r="62" fill="#E7F3EC" />
      <path d="M60 46 Q100 10 140 46 M140 46 Q150 100 100 118 M100 118 Q50 100 60 46" stroke="#0F6B4C" strokeWidth="2" strokeDasharray="4 6" fill="none" />
      {people.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="20" fill={p.c} />
          <circle cx={p.x} cy={p.y - 5} r="7" fill="#F3E7CF" />
          <path d={`M${p.x - 11} ${p.y + 13} Q${p.x} ${p.y - 1} ${p.x + 11} ${p.y + 13}`} fill="#F3E7CF" />
        </g>
      ))}
      <circle cx="100" cy="80" r="16" fill="#F7931A" />
      <path d="M102 69 L94 82 L100 82 L97 92 L107 78 L101 78 Z" fill="#fff" />
    </svg>
  );
}

export { LandingHeroPeople as LandingHeroArt } from "@/components/landing-visuals";
