"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/components/providers";
import { Card, ErrorState, Header, Loading, Notice, PillButton, PillLink, ProgressPot, Screen, StickyActions } from "@/components/ui";
import { ActivityLog, describeEvent, LedgerRow, RotationList } from "@/features/chamas/ledger-parts";
import { apiFetch, useApi, useLedgerEvents, useOnline } from "@/lib/client/api";
import { eat, frequencyLabel, kes, units } from "@/lib/client/format";
import type { Ledger } from "@/lib/client/types";

/** 05 Group Dashboard - Ledger (Figma 3:113). Live via SSE; badges follow canonical data. */
export default function LedgerPage() {
  const { t, mode } = useApp();
  const { groupId } = useParams<{ groupId: string }>();
  const online = useOnline();
  const ledger = useApi<Ledger>(`/api/chamas/${groupId}/ledger`);
  useLedgerEvents(groupId, ledger.refetch);
  const [announcement, setAnnouncement] = useState("");
  const announced = useRef(0);
  const [invite, setInvite] = useState<string | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const code = sessionStorage.getItem(`invite:${groupId}`);
    if (code) setTimeout(() => setInvite(code), 0);
  }, [groupId]);

  // Announce new settlement events once (polite live region, never repeated for the same sequence).
  useEffect(() => {
    const d = ledger.data;
    if (!d) return;
    if (announced.current === 0) {
      announced.current = d.lastSequence;
      return;
    }
    const fresh = d.activity.filter((e) => e.sequence > announced.current && ["CONTRIBUTION_SETTLED", "PAYOUT_SUCCEEDED", "CYCLE_FUNDED"].includes(e.type));
    announced.current = d.lastSequence;
    if (fresh.length) setTimeout(() => setAnnouncement(fresh.map((e) => describeEvent(e.type, e.payload)).join(". ")), 0);
  }, [ledger.data]);

  if (ledger.error && !ledger.data) return <ErrorState error={ledger.error} onRetry={ledger.refetch} />;
  if (!ledger.data) return <Loading />;
  const d = ledger.data;
  const mine = d.contributions.find((c) => c.isMe);
  const myPending = mine && mine.status !== "PAID" && d.cycle.status === "OPEN";
  const isOwner = d.me.role === "OWNER";
  const contributeHref = `/chamas/${groupId}/contribute`;
  const recipientFirst = d.cycle.recipient.name.split(" ")[0];

  async function newInvite() {
    setInviteBusy(true);
    try {
      const r = await apiFetch<{ code: string }>(`/api/chamas/${groupId}/invites`, { method: "POST" });
      sessionStorage.setItem(`invite:${groupId}`, r.code);
      setInvite(r.code);
    } finally {
      setInviteBusy(false);
    }
  }

  async function copyLink() {
    if (!invite) return;
    await navigator.clipboard.writeText(`${window.location.origin}/join/${invite}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <>
      <Header back="/home" title={d.group.name} />
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <Screen className="space-y-5">
        <p className="-mt-2 text-[13px] text-muted">
          {t("common.members", { n: d.group.memberCount })} · {kes(d.group.contributionKesMinor)} {frequencyLabel(t, d.group.frequency, d.group.customIntervalDays)} ·{" "}
          {d.group.settlementAsset === "BTC_SAT" ? "Bitcoin" : "USD-stable"}
        </p>

        <Card className="bg-forest text-white">
          <div className="flex items-center justify-between text-[13px] text-cream/80">
            <span>{t("common.roundOf", { n: d.cycle.round, total: d.cycle.totalRounds })}</span>
            <span>Due {eat(d.cycle.dueAt)}</span>
          </div>
          <p className="mt-2 text-[30px] leading-none font-extrabold">
            {kes(d.cycle.fundedKesMinor)}
            <span className="text-[18px] font-semibold text-cream/70"> / {kes(d.cycle.displayTargetKesMinor)}</span>
          </p>
          <p className="mt-1 text-[12px] text-cream/70">
            {units(d.cycle.fundedUnits, d.group.settlementAsset)} of {units(d.cycle.targetUnits, d.group.settlementAsset)} · rate {d.cycle.quote.rate} ({d.cycle.quote.mode === "DEMO" ? "illustrative" : "live"})
          </p>
          <div className="mt-4">
            <ProgressPot onDark paid={d.cycle.paidCount} total={d.cycle.totalCount} label={`${d.cycle.paidCount} of ${d.cycle.totalCount} paid`} />
          </div>
          <p className="mt-3 text-[14px] font-semibold">
            {d.cycle.paidCount}/{d.cycle.totalCount} {t("common.paid").toLowerCase()} · {t("ledger.payoutFires", { name: recipientFirst, n: d.cycle.totalCount })}
          </p>
          {d.payout ? (
            <Link href={`/chamas/${groupId}/payouts/${d.payout.id}`} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full bg-btc px-4 text-sm font-bold text-forest">
              {t(`payout.${d.payout.status}` as "payout.QUEUED")} →
            </Link>
          ) : null}
        </Card>

        {d.group.status === "COMPLETED" ? <Notice>{t("ledger.completed")}</Notice> : null}

        <section aria-labelledby="ledger-h">
          <h2 id="ledger-h" className="mb-2 text-[16px] font-bold">
            {t("ledger.shared")}
          </h2>
          <Card className="space-y-1 p-2">
            {d.contributions.map((c) => (
              <LedgerRow key={c.id} row={c} payHref={c.isMe && myPending && online ? contributeHref : undefined} />
            ))}
          </Card>
        </section>

        <section aria-labelledby="rot-h">
          <h2 id="rot-h" className="mb-2 text-[16px] font-bold">
            {t("ledger.rotation")}
          </h2>
          <Card className="p-2">
            <RotationList rotation={d.rotation} groupId={groupId} />
          </Card>
        </section>

        {isOwner ? (
          <section aria-labelledby="inv-h">
            <h2 id="inv-h" className="mb-2 text-[16px] font-bold">
              {t("ledger.invite")}
            </h2>
            <Card className="space-y-3">
              {invite ? (
                <>
                  <p className="text-sm text-muted">{t("ledger.inviteCode")}</p>
                  <p className="font-mono text-2xl font-bold tracking-widest">{invite}</p>
                  <PillButton variant="secondary" onClick={copyLink}>
                    {copied ? "Link copied" : t("ledger.inviteLink")}
                  </PillButton>
                </>
              ) : (
                <p className="text-sm text-muted">Invite codes are shown once and stored only as a hash. Create a fresh one to share.</p>
              )}
              <PillButton variant="ghost" onClick={newInvite} busy={inviteBusy}>
                {t("ledger.newInvite")}
              </PillButton>
            </Card>
          </section>
        ) : null}

        {d.history.length ? (
          <section aria-labelledby="hist-h">
            <h2 id="hist-h" className="mb-2 text-[16px] font-bold">
              {t("ledger.history")}
            </h2>
            <Card className="space-y-1 p-2">
              {d.history.map((h) => (
                <Link key={h.round} href={h.payoutId ? `/chamas/${groupId}/payouts/${h.payoutId}` : "#"} className="flex min-h-12 items-center justify-between rounded-xl px-2 hover:bg-sage">
                  <span className="font-semibold">{t("common.round", { n: h.round })} · {h.recipient}</span>
                  <span className="text-xs text-muted">{h.status === "PAID_OUT" ? `Paid out ${eat(h.paidOutAt, false)}` : h.status}</span>
                </Link>
              ))}
            </Card>
          </section>
        ) : null}

        {mode.provider === "flash" ? null : (
          <Link href={`/chamas/${groupId}/diaspora`} className="block rounded-[var(--radius-card)] border border-btc/40 bg-white p-4 text-sm font-semibold text-forest hover:bg-warn-wash">
            🇬🇧 → 🇰🇪 {t("ledger.payFromAbroad")} →
          </Link>
        )}

        <details className="rounded-[var(--radius-card)] bg-white p-4 shadow-[var(--shadow-card)]">
          <summary className="min-h-11 cursor-pointer text-[15px] font-bold">{t("ledger.activity")}</summary>
          <div className="mt-3">
            <ActivityLog items={d.activity} />
          </div>
        </details>
      </Screen>
      {d.cycle.status === "OPEN" ? (
        <StickyActions>
          {myPending ? (
            online ? (
              <PillLink href={contributeHref}>{t("ledger.contribute", { amount: kes(mine.dueKesMinor) })}</PillLink>
            ) : (
              <PillButton disabled>{t("ledger.contribute", { amount: kes(mine.dueKesMinor) })}</PillButton>
            )
          ) : mine?.receiptId ? (
            <PillLink href={`/receipts/${mine.receiptId}`} variant="secondary">
              ✓ {t("ledger.youPaid")}
            </PillLink>
          ) : null}
        </StickyActions>
      ) : null}
    </>
  );
}
