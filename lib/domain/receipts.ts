import { config } from "../config";
import { createHmac } from "node:crypto";
import { type Db, id, one, run } from "../db";
import type { Asset } from "../money";
import { bps } from "../money";
import { type Ctx, notFound } from "./context";
import { getQuote } from "./fx";
import { canonicalJson, sha256 } from "./ledger";
import type { ContributionRow, CycleRow, GroupRow, InvoiceRow, MemberRow, PayoutRow, DestinationSnapshot } from "./rows";

export type ReceiptKind = "CONTRIBUTION" | "PAYOUT" | "DIASPORA";

export interface ReceiptSnapshot {
  kind: ReceiptKind;
  receiptNumber: string;
  groupName: string;
  roundNumber: number;
  payerName: string;
  beneficiaryName?: string;
  recipientName?: string;
  totalKesMinor: string;
  principal: { units: string; asset: Asset };
  fee: { units: string; asset: string; note: string };
  fx: { pair: string; rate: string; mode: "LIVE" | "DEMO"; source: string; fetchedAt: string };
  diaspora?: {
    sourceMinor: string;
    sourceCurrency: string;
    rate: string;
    rateMode: "LIVE" | "DEMO";
    benchmark: { lowMinor: string; highMinor: string; currency: string; scope: string };
  };
  destinationLabel?: string;
  environment: string;
  mode: "DEMO" | "FLASH_TEST" | "FLASH_LIVE";
  providerProofRef: string;
  paymentHash?: string;
  settledAt: string;
  status: "SETTLED" | "PAID_OUT";
}

export const REMITTANCE_BENCHMARK = {
  lowBps: 340n,
  highBps: 440n,
  scope:
    "Historical UK to Kenya remittance cost range (World Bank Remittance Prices Worldwide, 2025, rounded 3.4% to 4.4%). Not a live bank quote.",
};

function persist(db: Db, secret: string, groupId: string, snap: ReceiptSnapshot, refs: { contributionId?: string; payoutId?: string }) {
  const json = canonicalJson(snap);
  const contentHash = sha256(json);
  const signature = createHmac("sha256", secret).update(contentHash).digest("hex");
  const rid = id();
  run(
    db,
    `INSERT INTO receipts (id, receipt_number, kind, group_id, contribution_id, payout_id, snapshot_json, content_hash, signature, settled_at, created_at)
     VALUES (:id, :num, :kind, :g, :c, :p, :json, :hash, :sig, :settled, :now)`,
    {
      id: rid,
      num: snap.receiptNumber,
      kind: snap.kind,
      g: groupId,
      c: refs.contributionId ?? null,
      p: refs.payoutId ?? null,
      json,
      hash: contentHash,
      sig: signature,
      settled: snap.settledAt,
      now: new Date().toISOString(),
    },
  );
  return rid;
}

const pad = (n: number, w: number) => String(n).padStart(w, "0");

/** Inside tx(): immutable receipt from settled records. */
export function createContributionReceipt(ctx: Ctx, invoice: InvoiceRow, settledAt: string, proofRef: string) {
  const db = ctx.db;
  const c = one<ContributionRow>(db, "SELECT * FROM contributions WHERE id = :id", { id: invoice.contribution_id })!;
  const cycle = one<CycleRow>(db, "SELECT * FROM cycles WHERE id = :id", { id: c.cycle_id })!;
  const group = one<GroupRow>(db, "SELECT * FROM groups WHERE id = :id", { id: cycle.group_id })!;
  const member = one<MemberRow>(db, "SELECT * FROM members WHERE id = :id", { id: c.member_id })!;
  const seq =
    ((one<{ n: number }>(
      db,
      "SELECT COUNT(*) AS n FROM receipts WHERE contribution_id IN (SELECT id FROM contributions WHERE cycle_id = :c)",
      { c: cycle.id },
    )?.n ?? 0) as number) + 1;
  const q = getQuote(db, invoice.quote_id);
  const isDiaspora = invoice.kind === "DIASPORA";
  let diaspora: ReceiptSnapshot["diaspora"];
  if (isDiaspora && invoice.diaspora_quote_id && invoice.diaspora_source_minor) {
    const dq = getQuote(db, invoice.diaspora_quote_id);
    const src = BigInt(invoice.diaspora_source_minor);
    diaspora = {
      sourceMinor: src.toString(),
      sourceCurrency: invoice.diaspora_source_currency ?? "GBP",
      rate: dq.rate_decimal,
      rateMode: dq.mode,
      benchmark: {
        lowMinor: bps(src, REMITTANCE_BENCHMARK.lowBps).toString(),
        highMinor: bps(src, REMITTANCE_BENCHMARK.highBps).toString(),
        currency: invoice.diaspora_source_currency ?? "GBP",
        scope: REMITTANCE_BENCHMARK.scope,
      },
    };
  }
  const snap: ReceiptSnapshot = {
    kind: isDiaspora ? "DIASPORA" : "CONTRIBUTION",
    receiptNumber: `CHM-${pad(group.number, 4)}-R${cycle.round_number}-${isDiaspora ? "D" : ""}${pad(seq, 2)}`,
    groupName: group.name,
    roundNumber: cycle.round_number,
    payerName: isDiaspora ? (invoice.payer_label ?? "Diaspora payer") : member.display_name,
    beneficiaryName: isDiaspora ? member.display_name : undefined,
    totalKesMinor: String(c.due_kes_minor),
    principal: { units: String(invoice.settled_units ?? invoice.amount_units), asset: invoice.asset },
    fee: {
      units: "0",
      asset: invoice.asset,
      note: "Incoming Lightning payment: no fee charged to the chama. The payer's wallet may charge its own fee.",
    },
    fx: {
      pair: `${q.base_currency}/${q.quote_currency}`,
      rate: q.rate_decimal,
      mode: q.mode,
      source: q.source,
      fetchedAt: q.fetched_at,
    },
    diaspora,
    environment: invoice.network,
    mode: invoice.provider === "demo" ? "DEMO" : receiptFlashMode(),
    providerProofRef: proofRef,
    paymentHash: invoice.payment_hash ?? undefined,
    settledAt,
    status: "SETTLED",
  };
  return persist(db, ctx.receiptSecret, group.id, snap, { contributionId: c.id });
}

export function createPayoutReceipt(ctx: Ctx, payout: PayoutRow) {
  const db = ctx.db;
  const cycle = one<CycleRow>(db, "SELECT * FROM cycles WHERE id = :id", { id: payout.cycle_id })!;
  const group = one<GroupRow>(db, "SELECT * FROM groups WHERE id = :id", { id: cycle.group_id })!;
  const recipient = one<MemberRow>(db, "SELECT * FROM members WHERE id = :id", { id: payout.recipient_member_id })!;
  const q = getQuote(db, cycle.quote_id);
  const dest = JSON.parse(payout.destination_snapshot) as DestinationSnapshot;
  const snap: ReceiptSnapshot = {
    kind: "PAYOUT",
    receiptNumber: `CHM-${pad(group.number, 4)}-R${cycle.round_number}-PO`,
    groupName: group.name,
    roundNumber: cycle.round_number,
    payerName: `${group.name} pot`,
    recipientName: recipient.display_name,
    totalKesMinor: String(cycle.display_target_kes_minor),
    principal: { units: String(payout.principal_units), asset: payout.asset },
    fee: {
      units: String(payout.fee_units),
      asset: payout.fee_asset,
      note: "Measured provider fee, paid from the operator fee reserve, not deducted from the pot.",
    },
    fx: { pair: `${q.base_currency}/${q.quote_currency}`, rate: q.rate_decimal, mode: q.mode, source: q.source, fetchedAt: q.fetched_at },
    destinationLabel: dest.label,
    environment: ctx.provider.network,
    mode: ctx.provider.name === "demo" ? "DEMO" : receiptFlashMode(),
    providerProofRef: payout.provider_payment_id ?? "",
    settledAt: payout.sent_at ?? new Date().toISOString(),
    status: "PAID_OUT",
  };
  return persist(db, ctx.receiptSecret, group.id, snap, { payoutId: payout.id });
}

export function getReceipt(ctx: Ctx, receiptId: string, userId: string) {
  const r = one<{
    id: string;
    group_id: string;
    kind: ReceiptKind;
    snapshot_json: string;
    content_hash: string;
    signature: string;
    receipt_number: string;
    payout_id: string | null;
    contribution_id: string | null;
  }>(ctx.db, "SELECT * FROM receipts WHERE id = :id", { id: receiptId });
  if (!r) throw notFound("Receipt not found");
  const member = one(ctx.db, "SELECT id FROM members WHERE group_id = :g AND user_id = :u", { g: r.group_id, u: userId });
  if (!member) throw notFound("Receipt not found");
  const expected = createHmac("sha256", ctx.receiptSecret).update(r.content_hash).digest("hex");
  const intact = sha256(r.snapshot_json) === r.content_hash && expected === r.signature;
  return {
    id: r.id,
    groupId: r.group_id,
    kind: r.kind,
    receiptNumber: r.receipt_number,
    payoutId: r.payout_id,
    snapshot: JSON.parse(r.snapshot_json) as ReceiptSnapshot,
    contentHash: r.content_hash,
    integrity: intact ? "VERIFIED" : "MISMATCH",
  };
}

function receiptFlashMode(): "FLASH_TEST" | "FLASH_LIVE" {
  return config().liveFunds ? "FLASH_LIVE" : "FLASH_TEST";
}
