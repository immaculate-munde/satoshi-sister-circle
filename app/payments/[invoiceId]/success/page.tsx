"use client";

import { useParams } from "next/navigation";
import { useT } from "@/components/providers";
import { ErrorState, Loading, MemberAvatar, Notice, PillLink, ProgressPot, Screen, StickyActions } from "@/components/ui";
import { useApi } from "@/lib/client/api";
import { eat, kes, units } from "@/lib/client/format";
import type { Invoice, Ledger } from "@/lib/client/types";

/** 07 Payment Success (Figma 5:237). Reload re-checks the canonical invoice; no client "paid" flag. */
export default function SuccessPage() {
  const t = useT();
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const inv = useApi<Invoice>(`/api/invoices/${invoiceId}`, { pollMs: 2500 });
  const ledger = useApi<Ledger>(inv.data ? `/api/chamas/${inv.data.groupId}/ledger` : null, { pollMs: 2500 });

  if (inv.error && !inv.data) return <ErrorState error={inv.error} onRetry={inv.refetch} />;
  if (!inv.data) return <Loading />;
  const i = inv.data;
  const ledgerHref = `/chamas/${i.groupId}`;

  if (i.status !== "PAID") {
    return (
      <Screen className="justify-center gap-4 text-center">
        <p className="text-[16px] font-semibold">{t("success.notYet")}</p>
        <PillLink href={`/chamas/${i.groupId}/contribute`}>{t("contribute.title")}</PillLink>
        <PillLink href={ledgerHref} variant="secondary">
          {t("success.back")}
        </PillLink>
      </Screen>
    );
  }

  // Use the latest cycle view for the payout banner; fall back to the invoice's own snapshot.
  const sameRound = ledger.data && ledger.data.cycle.round === i.round;
  const paid = sameRound ? ledger.data!.cycle.paidCount : i.cycle.paidCount;
  const total = i.cycle.totalCount;
  const recipient = ledger.data?.rotation.find((r) => r.round === i.round)?.name.split(" ")[0] ?? "";
  const payout = i.payout;
  const avatars = ledger.data && sameRound ? ledger.data.contributions : null;

  return (
    <>
      <Screen className="items-center pt-10 text-center">
        <div className="flex h-24 w-24 animate-fade-up items-center justify-center rounded-full bg-money text-5xl text-white" aria-hidden>
          ✓
        </div>
        <h1 className="mt-6 text-[26px] font-extrabold text-forest" aria-live="polite">
          {t("success.title")}
        </h1>
        <p className="mt-2 text-[36px] leading-none font-extrabold">{kes(i.kesMinor)}</p>
        <p className="mt-1 text-[14px] text-muted">
          {units(i.settledUnits ?? i.amountUnits, i.asset)} · {eat(i.paidAt)}
        </p>
        {i.kind === "DIASPORA" ? <p className="mt-1 text-[13px] text-muted">Paid by {i.payerLabel} for {i.memberName}</p> : null}
        {i.provider === "demo" ? <p className="mt-2 rounded-full bg-btc/20 px-3 py-1 text-[11px] font-bold text-forest">Simulated payment · demo provider</p> : null}

        {i.creditedToContribution === false ? (
          <div className="mt-4 w-full text-left">
            <Notice tone="warn">{t("success.duplicate")}</Notice>
          </div>
        ) : null}

        <div className="mt-8 w-full rounded-[var(--radius-card)] bg-white p-4 text-left shadow-[var(--shadow-card)]">
          {avatars ? (
            <div className="mb-3 flex -space-x-2">
              {avatars.map((c) => (
                <span key={c.id} className={c.status === "PAID" ? "" : "opacity-35"}>
                  <MemberAvatar name={c.name} size={36} ring />
                </span>
              ))}
            </div>
          ) : null}
          <ProgressPot paid={paid} total={total} />
          <p className="mt-2 text-[14px] font-semibold">{t("success.paidOf", { paid, total })}</p>
          <p className="mt-1 text-[13px] text-muted" role="status">
            {payout?.status === "SUCCEEDED"
              ? t("success.potSent", { name: recipient })
              : payout
                ? t("success.potFull", { name: recipient })
                : t("success.waiting", { n: total - paid, name: recipient })}
          </p>
        </div>
      </Screen>
      <StickyActions>
        {payout ? <PillLink href={`/chamas/${i.groupId}/payouts/${payout.id}`}>{t("success.seePayout")}</PillLink> : null}
        {i.receiptId ? (
          <PillLink href={`/receipts/${i.receiptId}`} variant={payout ? "secondary" : "primary"}>
            {t("success.receipt")}
          </PillLink>
        ) : null}
        <PillLink href={ledgerHref} variant="ghost">
          {t("success.back")}
        </PillLink>
      </StickyActions>
    </>
  );
}
