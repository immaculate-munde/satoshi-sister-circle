"use client";

import { useParams } from "next/navigation";
import { useApp } from "@/components/providers";
import { Card, ErrorState, Header, Loading, MemberAvatar, Notice, PillLink, Screen, StickyActions } from "@/components/ui";
import { useApi } from "@/lib/client/api";
import { eat, kes, units } from "@/lib/client/format";
import type { PayoutView } from "@/lib/client/types";

const TERMINAL = new Set(["SUCCEEDED", "FAILED"]);

/** 08 Payout - Automatic (Figma 5:267). "Sent" only after provider confirmation. */
export default function PayoutPage() {
  const { t } = useApp();
  const { groupId, payoutId } = useParams<{ groupId: string; payoutId: string }>();
  const p = useApi<PayoutView>(`/api/payouts/${payoutId}`, { pollMs: 2000 });

  if (p.error && !p.data) return <ErrorState error={p.error} onRetry={p.refetch} />;
  if (!p.data) return <Loading />;
  const d = p.data;
  const ok = d.status === "SUCCEEDED";
  const inFlight = !TERMINAL.has(d.status) && !d.needsOperatorReview;

  return (
    <>
      <Header back={`/chamas/${groupId}`} title={t("payout.title")} />
      <Screen className="space-y-5">
        <Card className={`text-center ${ok ? "bg-money text-white" : d.status === "FAILED" || d.needsOperatorReview ? "bg-danger-wash" : "bg-forest text-white"}`}>
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/15 text-3xl" aria-hidden>
            {ok ? "✓" : d.status === "FAILED" || d.needsOperatorReview ? "!" : <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-btc border-t-transparent" />}
          </div>
          <p className="mt-3 text-[20px] font-extrabold" role="status" aria-live="polite">
            {t(`payout.${d.status}` as "payout.QUEUED")}
          </p>
          <p className="mt-2 text-[34px] leading-none font-extrabold">{kes(d.kesMinor)}</p>
          <p className="mt-1 text-[13px] opacity-80">
            {units(d.principalUnits, d.asset)} · {t("payout.to", { name: d.recipient.name })}
          </p>
          {d.network.startsWith("DEMO") ? <p className="mx-auto mt-3 w-fit rounded-full bg-btc px-3 py-1 text-[11px] font-bold text-forest">Simulated transfer · demo provider</p> : null}
        </Card>

        {d.status === "UNKNOWN" && !d.needsOperatorReview ? <Notice tone="warn">{t("payout.unknownHint")}</Notice> : null}
        {d.needsOperatorReview ? <Notice tone="warn">{t("payout.reviewHint")}</Notice> : null}
        {d.status === "FAILED" && !d.needsOperatorReview ? <Notice tone="warn">{t("payout.failedHint")}</Notice> : null}

        <Card>
          <dl className="divide-y divide-line text-[14px]">
            <Row label={t("payout.trigger")} value={t("payout.whenAllPay")} />
            <Row label={t("payout.destination")} value={`${d.destinationLabel} ✓`} />
            <Row label={t("common.round", { n: d.round })} value={d.groupName} />
            <Row label={t("payout.fee")} value={ok ? `${units(d.feeUnits, d.asset)} (${t("payout.feeNote")})` : "Measured when sent"} />
            <Row label="Rate" value={`${d.quote.rate} (${d.quote.mode === "DEMO" ? "illustrative" : "live"})`} />
            {d.sentAt ? <Row label={t("payout.sentAt")} value={eat(d.sentAt)} /> : <Row label="Queued" value={eat(d.createdAt)} />}
            {d.providerPaymentId ? <Row label={t("payout.proof")} value={d.providerPaymentId.slice(0, 22)} mono /> : null}
            <Row label="Network" value={d.network} />
            {inFlight && d.attempts > 0 ? <Row label="Attempts" value={String(d.attempts)} /> : null}
          </dl>
        </Card>

        <section aria-labelledby="rot-h">
          <h2 id="rot-h" className="mb-2 text-[16px] font-bold">
            {t("payout.rotation")}
          </h2>
          <Card className="space-y-1 p-2">
            {d.rotation.map((r) => (
              <div key={r.round} className={`flex min-h-14 items-center gap-3 rounded-xl px-2 ${r.state === "THIS_PAYOUT" ? "bg-sage" : ""}`}>
                <MemberAvatar name={r.name} size={36} />
                <div className="flex-1">
                  <p className="font-semibold">{r.name}</p>
                  <p className="text-[12px] text-muted">
                    {t("common.round", { n: r.round })} · {eat(r.dueAt, false)}
                  </p>
                </div>
                <span className="text-xs font-semibold text-muted">
                  {r.state === "PAID_OUT" ? t("common.paid") : r.state === "THIS_PAYOUT" ? (ok ? t("common.paid") : "Now") : r.state === "CURRENT" ? "Collecting" : "Upcoming"}
                </span>
              </div>
            ))}
          </Card>
        </section>
      </Screen>
      <StickyActions>
        {d.receiptId ? <PillLink href={`/receipts/${d.receiptId}`}>{t("payout.viewReceipt")}</PillLink> : null}
        <PillLink href={`/chamas/${groupId}`} variant={d.receiptId ? "ghost" : "secondary"}>
          {t("success.back")}
        </PillLink>
      </StickyActions>
    </>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="text-muted">{label}</dt>
      <dd className={`text-right font-semibold ${mono ? "font-mono text-[12px] break-all" : ""}`}>{value}</dd>
    </div>
  );
}
