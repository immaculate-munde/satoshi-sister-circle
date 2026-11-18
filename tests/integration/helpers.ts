import { id, many, nowIso, one, openDb, run } from "@/lib/db";
import { createChama } from "@/lib/domain/chamas";
import type { Ctx } from "@/lib/domain/context";
import { acceptInvite } from "@/lib/domain/invites";
import { reconcileInvoice, requestInvoice } from "@/lib/domain/invoices";
import { DemoProvider } from "@/lib/payments/demo";

export class Clock {
  t = new Date("2026-11-06T06:00:00Z").getTime();
  now = () => new Date(this.t);
  advance(ms: number) {
    this.t += ms;
  }
}

export async function makeCtx() {
  const db = await openDb("memory:");
  const clock = new Clock();
  const provider = new DemoProvider(db, clock.now);
  const ctx: Ctx = {
    db,
    provider,
    now: clock.now,
    limits: { maxPrincipalUnits: 20000n, maxFeeUnits: 10n },
    receiptSecret: "test-receipt-secret-0123456789",
  };
  return { ctx, db, clock, provider };
}

export async function user(ctx: Ctx, name: string) {
  const uid = id();
  await run(ctx.db, "INSERT INTO users (id, display_name, created_at) VALUES (:id, :n, :now)", { id: uid, n: name, now: nowIso() });
  return uid;
}

/** Umoja fixture: Wanjiku -> Faith -> Amina, KES 5,000 weekly, BTC. All seats bound. */
export async function umoja(ctx: Ctx, asset: "BTC_SAT" | "USD_CENT" = "BTC_SAT") {
  const amina = await user(ctx, "Amina Otieno");
  const wanjiku = await user(ctx, "Wanjiku");
  const faith = await user(ctx, "Faith");
  const { group, invite } = await createChama(ctx, amina, {
    name: "Umoja Women Chama",
    contributionKes: "5000",
    frequency: "WEEKLY",
    settlementAsset: asset,
    firstDueDate: "2026-11-06",
    members: [
      { displayName: "Wanjiku", isMe: false, payoutPreference: "BTC" },
      { displayName: "Faith", isMe: false, payoutPreference: "USD" },
      { displayName: "Amina Otieno", isMe: true, payoutPreference: "BTC" },
    ],
  });
  const seats = await many<{ id: string; display_name: string }>(ctx.db, "SELECT id, display_name FROM members WHERE group_id = :g", { g: group.id });
  await acceptInvite(ctx, invite.code, wanjiku, seats.find((s) => s.display_name === "Wanjiku")!.id);
  await acceptInvite(ctx, invite.code, faith, seats.find((s) => s.display_name === "Faith")!.id);
  return { group, invite, users: { amina, wanjiku, faith } };
}

export async function payAs(ctx: Ctx, provider: DemoProvider, userId: string, groupId: string, opts: { reconcile?: boolean } = {}) {
  const inv = await requestInvoice(ctx, { userId, groupId, kind: "CONTRIBUTION" });
  const wallet = `user:${userId}:${inv.asset}`;
  await provider.ensureWallet(wallet, "payer", inv.asset, 1_000_000n);
  await provider.simulatePayment(inv.paymentHash!, wallet);
  if (opts.reconcile !== false) await reconcileInvoice(ctx, inv.id);
  return inv;
}

export const count = async (ctx: Ctx, sql: string, params: Record<string, string | number> = {}) =>
  Number(((await one<{ n: number }>(ctx.db, sql, params)) as { n: number }).n);
