"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { useT } from "@/components/providers";
import { Card, ErrorState, Field, Header, InlineError, Loading, MemberAvatar, Notice, PillButton, Screen, StatusBadge, inputClass } from "@/components/ui";
import { AmountSummary, InvoicePanel } from "@/features/payments/invoice-panel";
import { apiFetch, newIdempotencyKey, useApi } from "@/lib/client/api";
import { gbp, kes } from "@/lib/client/format";
import type { DiasporaContext, Invoice } from "@/lib/client/types";

/** 09 Diaspora Contribute - UK (Figma 5:326). Covers an existing obligation; payer recorded separately. */
export default function DiasporaPage() {
  const t = useT();
  const { groupId } = useParams<{ groupId: string }>();
  const ctx = useApi<DiasporaContext>(`/api/chamas/${groupId}/diaspora`);
  const [payerName, setPayerName] = useState("Njeri");
  const [payerCity, setPayerCity] = useState("London");
  const [memberId, setMemberId] = useState<string | null>(null);
  const [inv, setInv] = useState<Invoice | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (ctx.error && !ctx.data) return <ErrorState error={ctx.error} onRetry={ctx.refetch} />;
  if (!ctx.data) return <Loading />;
  const d = ctx.data;
  const open = d.obligations.filter((o) => o.status !== "PAID");
  const selected = memberId ?? open[0]?.memberId ?? null;

  async function pay(forceNew = false) {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const r = await apiFetch<Invoice>(`/api/chamas/${groupId}/diaspora-invoices`, {
        method: "POST",
        idempotencyKey: newIdempotencyKey(),
        body: { memberId: selected, payerName, payerCity, forceNew },
      });
      setInv(r);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const c = d.comparison;

  return (
    <>
      <Header back={`/chamas/${groupId}`} title={t("diaspora.title")} />
      <Screen className="space-y-5">
        {inv ? (
          <>
            <AmountSummary inv={inv} />
            <p className="-mt-3 text-center text-[13px] text-muted">
              {gbp(inv.diaspora?.sourceMinor ?? "0")} from {inv.payerLabel} · rate {inv.diaspora?.rate} KES/GBP (illustrative)
            </p>
            <InvoicePanel initial={inv} onRegenerate={() => pay(true)} />
          </>
        ) : (
          <>
            <p className="-mt-2 text-[14px] text-muted">{t("diaspora.subtitle")}</p>
            <Card className="bg-forest text-center text-white">
              <p className="text-[13px] text-cream/80">
                {d.groupName} · Round {d.round}
              </p>
              <p className="mt-2 text-[40px] leading-none font-extrabold">{gbp(d.quote.gbpMinor)}</p>
              <p className="mt-1 text-[14px] text-cream/85">{t("diaspora.equivalent", { kes: kes(d.quote.kesMinor) })}</p>
              <p className="mt-2 text-[11px] text-cream/60">
                {d.quote.rate} KES/GBP · {d.quote.source}
              </p>
            </Card>

            <div className="grid grid-cols-2 gap-3">
              <Field label={t("diaspora.payer")} htmlFor="payer">
                <input id="payer" className={inputClass} value={payerName} onChange={(e) => setPayerName(e.target.value)} maxLength={40} />
              </Field>
              <Field label={t("diaspora.city")} htmlFor="city">
                <input id="city" className={inputClass} value={payerCity} onChange={(e) => setPayerCity(e.target.value)} maxLength={40} />
              </Field>
            </div>

            {d.roundOpen && open.length ? (
              <fieldset className="space-y-2">
                <legend className="mb-1 text-sm font-semibold">{t("diaspora.covering")}</legend>
                {d.obligations.map((o) => (
                  <label
                    key={o.memberId}
                    className={`flex min-h-14 items-center gap-3 rounded-2xl border px-3 ${o.status === "PAID" ? "cursor-not-allowed border-line bg-white opacity-60" : selected === o.memberId ? "cursor-pointer border-money bg-sage" : "cursor-pointer border-line bg-white"}`}
                  >
                    <input type="radio" name="member" disabled={o.status === "PAID"} checked={selected === o.memberId} onChange={() => setMemberId(o.memberId)} className="h-5 w-5 accent-[#0F6B4C]" />
                    <MemberAvatar name={o.name} size={32} />
                    <span className="flex-1 font-semibold">{o.name}</span>
                    <StatusBadge status={o.status} />
                  </label>
                ))}
              </fieldset>
            ) : (
              <Notice>{t("diaspora.allPaid")}</Notice>
            )}

            <section aria-labelledby="cmp-h" className="space-y-2">
              <h2 id="cmp-h" className="text-[16px] font-bold">
                {t("diaspora.compare")}
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <Card>
                  <p className="text-[12px] text-muted">{t("diaspora.traditional")}</p>
                  <p className="mt-1 text-[18px] font-extrabold">
                    {gbp(c.traditional.lowMinor)} – {gbp(c.traditional.highMinor)}
                  </p>
                  <p className="mt-1 text-[11px] text-muted">3.4% – 4.4%</p>
                </Card>
                <Card>
                  <p className="text-[12px] text-muted">{t("diaspora.lightning")}</p>
                  <p className="mt-1 text-[18px] font-extrabold text-money">{gbp(c.lightning.networkFeeMinor)}</p>
                  <p className="mt-1 text-[11px] text-muted">to receive, measured</p>
                </Card>
              </div>
              <p className="text-[11px] leading-snug text-muted">{c.traditional.scope}</p>
              <p className="text-[11px] leading-snug text-muted">{c.lightning.scope} We don&apos;t claim an end-to-end saving until every leg is measured.</p>
            </section>

            <Notice tone="warn">
              <p className="mb-1 font-semibold">{t("diaspora.notIncluded")}</p>
              <ul className="list-disc space-y-0.5 pl-4">
                {d.unavailableLegs.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </Notice>
            <InlineError message={error} />
            <PillButton onClick={() => pay()} busy={busy} disabled={!selected || !payerName.trim() || !d.roundOpen}>
              {t("diaspora.pay", { amount: gbp(d.quote.gbpMinor) })} {d.settlementAsset === "BTC_SAT" ? "in sats" : "in USD-stable"}
            </PillButton>
          </>
        )}
      </Screen>
    </>
  );
}
