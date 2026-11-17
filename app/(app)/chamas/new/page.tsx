"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/components/providers";
import { Card, Field, Header, InlineError, MemberAvatar, Notice, PillButton, Screen, StickyActions, inputClass } from "@/components/ui";
import { RosterEditor, type RosterMember } from "@/features/chamas/roster-editor";
import { apiFetch, newIdempotencyKey, useApi } from "@/lib/client/api";
import { units } from "@/lib/client/format";
import type { Me } from "@/lib/client/types";
import { DEMO_RATES } from "@/lib/domain/rates";
import { type Asset, fiatMinorToUnits } from "@/lib/money";

function defaultFirstDue() {
  const d = new Date(Date.now() + 3 * 3600_000 + 7 * 86400_000);
  return d.toISOString().slice(0, 10);
}

/** 04 Create Chama (Figma 3:62). Defaults match the canonical Umoja fixture. */
export default function CreateChamaPage() {
  const { t, mode } = useApp();
  const router = useRouter();
  const me = useApi<Me>("/api/me");
  const myName = me.data?.user?.displayName ?? "Amina Otieno";
  const realMoney = mode.provider === "flash";
  const [name, setName] = useState(realMoney ? "" : "Umoja Women Chama");
  const [amount, setAmount] = useState("5000");
  const [frequency, setFrequency] = useState<"WEEKLY" | "MONTHLY" | "CUSTOM">("WEEKLY");
  const [customDays, setCustomDays] = useState("14");
  const [asset, setAsset] = useState<Asset>(mode.bitcoinEnabled ? "BTC_SAT" : "USD_CENT");
  const [firstDue, setFirstDue] = useState(defaultFirstDue);
  const [roster, setRoster] = useState<RosterMember[] | null>(null);
  const [rosterOpen, setRosterOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idemKey = useRef<string>("");

  useEffect(() => {
    if (!idemKey.current) idemKey.current = newIdempotencyKey();
  }, []);

  // Canonical fixture order Wanjiku -> Faith -> Amina; the signed-in user takes their own seat (or Amina's).
  const fixture = ["Wanjiku", "Faith", "Amina Otieno"];
  const mySeat = fixture.includes(myName) ? fixture.indexOf(myName) : 2;
  const members: RosterMember[] =
    roster ??
    (realMoney
      ? [myName, "", ""].map((n, i) => ({ key: String(i), displayName: n, isMe: i === 0, payoutPreference: "USD" as const, destinationRef: "" }))
      : fixture.map((n, i) => ({
      key: String(i),
      displayName: i === mySeat ? myName : n,
      isMe: i === mySeat,
      payoutPreference: n === "Faith" ? "USD" : "BTC",
      destinationRef: "",
    })));

  const preview = useMemo(() => {
    if (!/^\d{1,7}$/.test(amount) || amount === "0") return null;
    const rate = asset === "BTC_SAT" ? DEMO_RATES.KES_BTC_SAT : (me.data?.fxUsdCentsPerKes ?? (realMoney ? null : DEMO_RATES.KES_USD_CENT));
    if (!rate) return null;
    return { per: fiatMinorToUnits(BigInt(amount) * 100n, rate), rate };
  }, [amount, asset, me.data?.fxUsdCentsPerKes, realMoney]);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ groupId: string; invite: { code: string } }>("/api/chamas", {
        method: "POST",
        idempotencyKey: idemKey.current,
        body: {
          name,
          contributionKes: amount,
          frequency,
          customIntervalDays: frequency === "CUSTOM" ? Number(customDays) : undefined,
          settlementAsset: asset,
          firstDueDate: firstDue,
          members: members.map((m) => ({
            displayName: m.displayName,
            isMe: m.isMe,
            payoutPreference: m.payoutPreference,
            destinationRef: m.destinationRef || undefined,
          })),
        },
      });
      // The plaintext invite code is only returned once (we store a hash). Hand it to the Ledger.
      sessionStorage.setItem(`invite:${res.groupId}`, res.invite.code);
      router.replace(`/chamas/${res.groupId}`);
    } catch (e) {
      setError((e as Error).message);
      idemKey.current = newIdempotencyKey();
      setBusy(false);
    }
  }

  const freqBtn = (f: typeof frequency, label: string) => (
    <button
      type="button"
      onClick={() => setFrequency(f)}
      aria-pressed={frequency === f}
      className={`min-h-11 flex-1 rounded-full text-sm font-semibold ${frequency === f ? "bg-money text-white" : "bg-white text-ink border border-line"}`}
    >
      {label}
    </button>
  );

  const assetBtn = (a: Asset, label: string, hint: string, icon: string) => (
    <button
      type="button"
      onClick={() => setAsset(a)}
      aria-pressed={asset === a}
      className={`flex min-h-16 flex-1 items-center gap-2 rounded-2xl border p-3 text-left ${asset === a ? "border-money bg-sage" : "border-line bg-white"}`}
    >
      <span className={`flex h-9 w-9 items-center justify-center rounded-full text-white ${a === "BTC_SAT" ? "bg-btc" : "bg-money"}`} aria-hidden>
        {icon}
      </span>
      <span>
        <span className="block text-sm font-bold">{label}</span>
        <span className="block text-[11px] text-muted">{hint}</span>
      </span>
    </button>
  );

  return (
    <>
      <Header back="/home" title={t("create.title")} />
      <Screen className="space-y-5">
        <Field label={t("create.name")} htmlFor="name">
          <input id="name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        </Field>
        <Field
          label={t("create.contribution")}
          htmlFor="amount"
          hint={preview ? t("create.rate", { units: units(preview.per, asset), rate: preview.rate }) : undefined}
        >
          <div className="flex items-center rounded-2xl border border-line bg-white pl-4 focus-within:border-money">
            <span className="font-semibold text-muted">KES</span>
            <input
              id="amount"
              inputMode="numeric"
              className="min-h-12 flex-1 bg-transparent px-2 text-[20px] font-bold focus:outline-none"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, "").slice(0, 7))}
            />
          </div>
        </Field>
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">{t("create.frequency")}</legend>
          <div className="flex gap-2">
            {freqBtn("WEEKLY", t("create.weekly"))}
            {freqBtn("MONTHLY", t("create.monthly"))}
            {freqBtn("CUSTOM", t("create.custom"))}
          </div>
          {frequency === "CUSTOM" ? (
            <Field label={t("create.everyDays")} htmlFor="days">
              <input id="days" inputMode="numeric" className={inputClass} value={customDays} onChange={(e) => setCustomDays(e.target.value.replace(/\D/g, "").slice(0, 3))} />
            </Field>
          ) : null}
        </fieldset>
        <Field label={t("create.firstDue")} htmlFor="due" hint="18:00 EAT">
          <input id="due" type="date" className={inputClass} value={firstDue} onChange={(e) => setFirstDue(e.target.value)} />
        </Field>
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">{t("create.currency")}</legend>
          <div className="flex gap-2">
            {mode.bitcoinEnabled ? assetBtn("BTC_SAT", t("create.bitcoin"), t("create.bitcoinHint"), "₿") : null}
            {assetBtn("USD_CENT", t("create.usd"), t("create.usdHint"), "$")}
          </div>
        </fieldset>
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">{t("create.order")}</h2>
            <button type="button" onClick={() => setRosterOpen(true)} className="min-h-11 rounded-full px-3 text-sm font-semibold text-money hover:bg-sage">
              {t("create.edit")}
            </button>
          </div>
          <ol className="space-y-2">
            {members.map((m, i) => (
              <li key={m.key} className="flex items-center gap-3">
                <span className="w-5 text-center text-sm font-bold text-muted">{i + 1}</span>
                <MemberAvatar name={m.displayName || "?"} size={34} />
                <span className="flex-1 font-semibold">
                  {m.displayName}
                  {m.isMe ? <span className="ml-1 text-xs font-normal text-muted">({t("common.you")})</span> : null}
                </span>
                <span className="text-xs text-muted">{m.payoutPreference === "BTC" ? "BTC" : "USD-stable"}</span>
              </li>
            ))}
          </ol>
        </Card>
        {members.some((m) => (m.payoutPreference === "BTC") !== (asset === "BTC_SAT")) ? (
          <Notice tone="warn">
            Some members prefer {asset === "BTC_SAT" ? "USD-stable" : "Bitcoin"}. Cross-asset payout is not available yet: this cycle pays out in{" "}
            {asset === "BTC_SAT" ? "Bitcoin (sats)" : "Flash USD-stable"} only. Preferences are saved for later.
          </Notice>
        ) : null}
        <p className="text-xs text-muted">{t("create.rulesNote")}</p>
        <InlineError message={error} />
      </Screen>
      <StickyActions>
        <PillButton onClick={submit} busy={busy} disabled={!name.trim() || !preview || members.length < 3 || members.some((m) => !m.displayName.trim() || (realMoney && !m.destinationRef.trim()))}>
          {t("create.submit")}
        </PillButton>
        {mode.provider === "demo" ? <p className="text-center text-[11px] text-muted">Demo mode: each member gets a verified simulated wallet.</p> : null}
      </StickyActions>
      <RosterEditor open={rosterOpen} onClose={() => setRosterOpen(false)} roster={members} onChange={setRoster} />
    </>
  );
}
