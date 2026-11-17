"use client";

import { useApp } from "@/components/providers";
import { Dialog, MemberAvatar, PillButton, inputClass } from "@/components/ui";

export interface RosterMember {
  key: string;
  displayName: string;
  isMe: boolean;
  payoutPreference: "BTC" | "USD";
  destinationRef: string;
}

/** Add / remove / rename / reorder members. Order = payout rotation. Fully keyboard operable. */
export function RosterEditor({
  open,
  onClose,
  roster,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  roster: RosterMember[];
  onChange: (r: RosterMember[]) => void;
}) {
  const { t, mode } = useApp();
  const update = (i: number, patch: Partial<RosterMember>) => onChange(roster.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= roster.length) return;
    const next = [...roster];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <Dialog open={open} onClose={onClose} title={t("roster.title")}>
      <ol className="space-y-3">
        {roster.map((m, i) => (
          <li key={m.key} className="rounded-2xl border border-line p-3">
            <div className="flex items-center gap-2">
              <span className="w-6 text-center text-sm font-bold text-muted" aria-hidden>
                {i + 1}
              </span>
              <MemberAvatar name={m.displayName || "?"} size={32} />
              <label className="sr-only" htmlFor={`m-${m.key}`}>
                Member {i + 1} name
              </label>
              <input id={`m-${m.key}`} className={`${inputClass} min-h-11 flex-1`} value={m.displayName} maxLength={40} onChange={(e) => update(i, { displayName: e.target.value })} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 pl-8">
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input type="radio" name="me" checked={m.isMe} onChange={() => onChange(roster.map((x, j) => ({ ...x, isMe: j === i })))} className="h-5 w-5 accent-[#0F6B4C]" />
                {t("roster.me")}
              </label>
              <label className="flex min-h-11 items-center gap-1 text-sm">
                <span className="text-muted">{t("roster.pref")}</span>
                <select value={m.payoutPreference} onChange={(e) => update(i, { payoutPreference: e.target.value as "BTC" | "USD" })} className="min-h-10 rounded-xl border border-line bg-white px-2">
                  <option value="BTC">BTC</option>
                  <option value="USD">USD-stable</option>
                </select>
              </label>
              <div className="ml-auto flex gap-1">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={t("roster.up", { name: m.displayName })} className="h-11 w-11 rounded-full border border-line disabled:opacity-30">
                  ↑
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === roster.length - 1} aria-label={t("roster.down", { name: m.displayName })} className="h-11 w-11 rounded-full border border-line disabled:opacity-30">
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => onChange(roster.filter((_, j) => j !== i))}
                  disabled={roster.length <= 3 || m.isMe}
                  aria-label={t("roster.remove", { name: m.displayName })}
                  className="h-11 w-11 rounded-full border border-line text-danger disabled:opacity-30"
                >
                  ✕
                </button>
              </div>
            </div>
            {mode.provider === "flash" ? (
              <div className="mt-2 pl-8">
                <label className="text-xs text-muted" htmlFor={`d-${m.key}`}>
                  {t("roster.flashUser")}
                </label>
                <input id={`d-${m.key}`} className={`${inputClass} min-h-11`} value={m.destinationRef} onChange={(e) => update(i, { destinationRef: e.target.value })} placeholder="flash_username" />
              </div>
            ) : null}
          </li>
        ))}
      </ol>
      <div className="mt-4 space-y-2">
        <PillButton
          variant="secondary"
          disabled={roster.length >= 20}
          onClick={() =>
            onChange([...roster, { key: crypto.randomUUID(), displayName: `Member ${roster.length + 1}`, isMe: false, payoutPreference: mode.bitcoinEnabled ? "BTC" : "USD", destinationRef: "" }])
          }
        >
          + {t("roster.add")}
        </PillButton>
        <PillButton onClick={onClose}>{t("roster.done")}</PillButton>
      </div>
    </Dialog>
  );
}
