import { createHash } from "node:crypto";
import { type Db, id, many, one, run } from "../db";

/** Deterministic JSON: sorted keys, bigint as string. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(normalize(value));
}

function normalize(v: unknown): unknown {
  if (typeof v === "bigint") return v.toString();
  if (Array.isArray(v)) return v.map(normalize);
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.keys(v as Record<string, unknown>)
        .sort()
        .filter((k) => (v as Record<string, unknown>)[k] !== undefined)
        .map((k) => [k, normalize((v as Record<string, unknown>)[k])]),
    );
  }
  return v;
}

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

const GENESIS = "0".repeat(64);

export type LedgerEventType =
  | "GROUP_CREATED"
  | "MEMBER_JOINED"
  | "INVITE_CREATED"
  | "CYCLE_OPENED"
  | "RULES_LOCKED"
  | "INVOICE_CREATED"
  | "CONTRIBUTION_SETTLED"
  | "CONTRIBUTION_UNDERPAID"
  | "CONTRIBUTION_LATE"
  | "OVERPAYMENT_RECORDED"
  | "CYCLE_FUNDED"
  | "PAYOUT_QUEUED"
  | "PAYOUT_SUBMITTED"
  | "PAYOUT_SUCCEEDED"
  | "PAYOUT_RETRY_SCHEDULED"
  | "PAYOUT_FAILED"
  | "PAYOUT_UNKNOWN"
  | "PAYOUT_OPERATOR_REVIEW"
  | "GROUP_COMPLETED";

/**
 * Append a hash-chained audit event. Must be called inside await tx(). Tamper-evident relative to an
 * exported checkpoint hash, not tamper-proof against someone who rewrites the entire chain.
 */
export async function appendEvent(
  db: Db,
  e: { groupId: string; cycleId?: string | null; type: LedgerEventType; payload: Record<string, unknown>; actor: string; at: Date },
) {
  const prev = await one<{ sequence: number; event_hash: string }>(
    db,
    "SELECT sequence, event_hash FROM ledger_events WHERE group_id = :g ORDER BY sequence DESC LIMIT 1",
    { g: e.groupId },
  );
  const sequence = (prev?.sequence ?? 0) + 1;
  const previousHash = prev?.event_hash ?? GENESIS;
  const canonicalPayload = canonicalJson(e.payload);
  const occurredAt = e.at.toISOString();
  const eventHash = sha256(
    canonicalJson({ groupId: e.groupId, sequence, type: e.type, payload: canonicalPayload, previousHash, occurredAt, actor: e.actor }),
  );
  await run(
    db,
    `INSERT INTO ledger_events (id, group_id, cycle_id, sequence, type, canonical_payload, previous_hash, event_hash, occurred_at, actor_ref)
     VALUES (:id, :g, :c, :seq, :type, :payload, :prev, :hash, :at, :actor)`,
    {
      id: id(),
      g: e.groupId,
      c: e.cycleId ?? null,
      seq: sequence,
      type: e.type,
      payload: canonicalPayload,
      prev: previousHash,
      hash: eventHash,
      at: occurredAt,
      actor: e.actor,
    },
  );
  return { sequence, eventHash };
}

export async function verifyChain(db: Db, groupId: string): Promise<{ ok: boolean; brokenAt?: number; head: string }> {
  const rows = await many<{
    sequence: number;
    type: string;
    canonical_payload: string;
    previous_hash: string;
    event_hash: string;
    occurred_at: string;
    actor_ref: string;
  }>(db, "SELECT * FROM ledger_events WHERE group_id = :g ORDER BY sequence", { g: groupId });
  let prev = GENESIS;
  for (const r of rows) {
    const expect = sha256(
      canonicalJson({
        groupId,
        sequence: r.sequence,
        type: r.type,
        payload: r.canonical_payload,
        previousHash: prev,
        occurredAt: r.occurred_at,
        actor: r.actor_ref,
      }),
    );
    if (r.previous_hash !== prev || r.event_hash !== expect) return { ok: false, brokenAt: r.sequence, head: prev };
    prev = r.event_hash;
  }
  return { ok: true, head: prev };
}
