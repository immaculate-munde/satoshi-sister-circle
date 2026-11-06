"use client";

import Link from "next/link";
import { useT } from "@/components/providers";
import { MemberAvatar, StatusBadge } from "@/components/ui";
import { eat } from "@/lib/client/format";
import type { Ledger } from "@/lib/client/types";

type Row = Ledger["contributions"][number];

export function LedgerRow({ row, payHref }: { row: Row; payHref?: string }) {
  const t = useT();
  const body = (
    <>
      <MemberAvatar name={row.name} size={40} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">
          {row.name}
          {row.isMe ? <span className="ml-1 text-xs font-normal text-muted">({t("common.you")})</span> : null}
        </p>
        <p className="truncate text-[12px] text-muted">
          {row.status === "PAID"
            ? `${eat(row.paidAt)}${row.payerLabel ? ` · via ${row.payerLabel}` : ""}`
            : row.status === "LATE"
              ? t("common.late")
              : t("common.pending")}
        </p>
      </div>
      <StatusBadge status={row.status} />
    </>
  );
  const cls = "flex min-h-16 items-center gap-3 rounded-2xl px-2 py-2";
  if (row.status === "PAID" && row.receiptId) {
    return (
      <Link href={`/receipts/${row.receiptId}`} className={`${cls} hover:bg-sage`} aria-label={`${row.name}, ${t("common.paid")}. View receipt`}>
        {body}
      </Link>
    );
  }
  if (payHref) {
    return (
      <Link href={payHref} className={`${cls} bg-warn-wash/60 hover:bg-warn-wash`}>
        {body}
      </Link>
    );
  }
  return <div className={cls}>{body}</div>;
}

export function RotationList({ rotation, groupId }: { rotation: Ledger["rotation"]; groupId: string }) {
  const t = useT();
  return (
    <ol className="space-y-1">
      {rotation.map((r) => {
        const inner = (
          <>
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                r.state === "PAID_OUT" ? "bg-money text-white" : r.state === "CURRENT" ? "bg-btc text-forest" : "bg-sage text-muted"
              }`}
              aria-hidden
            >
              {r.state === "PAID_OUT" ? "✓" : r.round}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">
                {r.name}
                {!r.joined ? <span className="ml-1 text-xs font-normal text-muted">(invited)</span> : null}
              </p>
              <p className="text-[12px] text-muted">
                {t("common.round", { n: r.round })} · {eat(r.dueAt, false)}
              </p>
            </div>
            <span className="text-xs font-semibold text-muted">
              {r.state === "PAID_OUT" ? t("common.paid") : r.state === "CURRENT" ? (r.payoutStatus ?? "Collecting") : ""}
            </span>
          </>
        );
        return (
          <li key={r.memberId}>
            {r.payoutId ? (
              <Link href={`/chamas/${groupId}/payouts/${r.payoutId}`} className="flex min-h-14 items-center gap-3 rounded-2xl px-2 hover:bg-sage">
                {inner}
              </Link>
            ) : (
              <div className="flex min-h-14 items-center gap-3 px-2">{inner}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

const EVENT_LABEL: Record<string, (p: Record<string, unknown>) => string> = {
  GROUP_CREATED: (p) => `Chama created: ${p.name}`,
  MEMBER_JOINED: (p) => `${p.member} joined`,
  INVITE_CREATED: () => "Invite code created",
  CYCLE_OPENED: (p) => `Round ${p.round} opened, payout to ${p.recipient}`,
  RULES_LOCKED: () => "Rules locked after first payment",
  INVOICE_CREATED: (p) => `${p.kind === "DIASPORA" ? "Diaspora invoice" : "Invoice"} created`,
  CONTRIBUTION_SETTLED: (p) => `${p.member} paid${p.payer !== p.member ? ` (by ${p.payer})` : ""}`,
  CONTRIBUTION_UNDERPAID: () => "Partial payment received",
  CONTRIBUTION_LATE: (p) => `${p.member} is late`,
  OVERPAYMENT_RECORDED: () => "Extra payment recorded for refund/credit",
  CYCLE_FUNDED: (p) => `Round ${p.round} fully funded`,
  PAYOUT_QUEUED: () => "Automatic payout queued",
  PAYOUT_SUBMITTED: () => "Payout sent to provider",
  PAYOUT_SUCCEEDED: (p) => `Payout confirmed to ${p.recipient}`,
  PAYOUT_RETRY_SCHEDULED: () => "Payout retry scheduled",
  PAYOUT_FAILED: () => "Payout failed",
  PAYOUT_UNKNOWN: () => "Payout outcome being reconciled",
  PAYOUT_OPERATOR_REVIEW: () => "Payout flagged for operator review",
  GROUP_COMPLETED: () => "Full rotation complete",
};

export function ActivityLog({ items }: { items: Ledger["activity"] }) {
  return (
    <ol className="space-y-2">
      {items.map((e) => (
        <li key={e.sequence} className="flex gap-3 text-[13px]">
          <span className="w-8 shrink-0 text-right font-mono text-[11px] text-muted">#{e.sequence}</span>
          <div className="min-w-0 flex-1">
            <p>{EVENT_LABEL[e.type]?.(e.payload) ?? e.type}</p>
            <p className="font-mono text-[10px] text-muted">
              {eat(e.occurredAt)} · {e.hash}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function describeEvent(type: string, payload: Record<string, unknown>) {
  return EVENT_LABEL[type]?.(payload) ?? type;
}
