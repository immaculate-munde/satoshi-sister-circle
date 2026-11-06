import { describe, expect, it } from "vitest";
import { getLedger, listChamas } from "@/lib/domain/chamas";
import { DomainError } from "@/lib/domain/context";
import { createDiasporaInvoice } from "@/lib/domain/diaspora";
import { applyProviderStatus, getInvoice, reconcileInvoice, requestInvoice } from "@/lib/domain/invoices";
import { verifyChain } from "@/lib/domain/ledger";
import { processPayouts, reconcileUnknownPayouts } from "@/lib/domain/payouts";
import { getReceipt } from "@/lib/domain/receipts";
import type { FoundPayment } from "@/lib/payments/provider";
import { count, makeCtx, payAs, umoja, user } from "./helpers";

const memberWallet = (ctx: ReturnType<typeof makeCtx>["ctx"], groupId: string, name: string) =>
  (ctx.db.prepare("SELECT verified_destination_ref AS w FROM members WHERE group_id = ? AND display_name = ?").get(groupId, name) as { w: string }).w;

describe("contribution -> automatic payout", () => {
  it("three verified settlements produce exactly one payout and one payout receipt", async () => {
    const { ctx, provider } = makeCtx();
    const { group, users } = await umoja(ctx);
    const wanjikuWallet = memberWallet(ctx, group.id, "Wanjiku");

    for (const [i, u] of [users.wanjiku, users.faith].entries()) {
      await payAs(ctx, provider, u, group.id);
      expect(getLedger(ctx, group.id, users.amina).cycle.paidCount).toBe(i + 1);
    }
    expect(count(ctx, "SELECT COUNT(*) AS n FROM payouts")).toBe(0);
    await payAs(ctx, provider, users.amina, group.id);
    expect(count(ctx, "SELECT COUNT(*) AS n FROM payouts")).toBe(1);

    await processPayouts(ctx, "w1");
    await processPayouts(ctx, "w1");
    const payout = ctx.db.prepare("SELECT * FROM payouts").get() as { status: string; principal_units: number; id: string };
    expect(payout.status).toBe("SUCCEEDED");
    expect(payout.principal_units).toBe(9660);
    expect(await provider.getBalance(wanjikuWallet)).toBe("9660");
    expect(count(ctx, "SELECT COUNT(*) AS n FROM demo_transfers WHERE request_id LIKE 'payout-%'")).toBe(1);

    const receipts = ctx.db.prepare("SELECT id, kind, receipt_number FROM receipts ORDER BY receipt_number").all() as { id: string; kind: string; receipt_number: string }[];
    expect(receipts.map((r) => r.receipt_number)).toEqual(["CHM-0001-R1-01", "CHM-0001-R1-02", "CHM-0001-R1-03", "CHM-0001-R1-PO"]);
    const po = getReceipt(ctx, receipts[3].id, users.wanjiku);
    expect(po.snapshot.totalKesMinor).toBe("1500000");
    expect(po.integrity).toBe("VERIFIED");
    const c3 = getReceipt(ctx, receipts[2].id, users.amina);
    expect(c3.snapshot.totalKesMinor).toBe("500000");
    expect(c3.snapshot.principal.units).toBe("3220");

    // Rotation advanced only after confirmed success.
    const ledger = getLedger(ctx, group.id, users.amina);
    expect(ledger.cycle.round).toBe(2);
    expect(ledger.cycle.recipient.name).toBe("Faith");
    expect(verifyChain(ctx.db, group.id).ok).toBe(true);
    expect(listChamas(ctx, users.amina).totals.btcSats).toBe("3220");
  });

  it("works the same for a USD-stable chama, in cents, without mixing assets", async () => {
    const { ctx, provider } = makeCtx();
    const { group, users } = await umoja(ctx, "USD_CENT");
    for (const u of [users.wanjiku, users.faith, users.amina]) await payAs(ctx, provider, u, group.id);
    await processPayouts(ctx, "w1");
    const p = ctx.db.prepare("SELECT asset, principal_units, status FROM payouts").get() as Record<string, unknown>;
    expect(p).toMatchObject({ asset: "USD_CENT", principal_units: 3870 * 3, status: "SUCCEEDED" });
    expect(listChamas(ctx, users.amina).totals).toMatchObject({ btcSats: "0", usdCents: "3870" });
  });

  it("an invoice click, copy or QR alone never marks anything paid", async () => {
    const { ctx } = makeCtx();
    const { group, users } = await umoja(ctx);
    const inv = await requestInvoice(ctx, { userId: users.wanjiku, groupId: group.id, kind: "CONTRIBUTION" });
    expect(await reconcileInvoice(ctx, inv.id)).toBe("PENDING");
    expect(getLedger(ctx, group.id, users.amina).cycle.paidCount).toBe(0);
  });

  it("reuses an open invoice instead of creating duplicates (refresh/back navigation)", async () => {
    const { ctx } = makeCtx();
    const { group, users } = await umoja(ctx);
    const a = await requestInvoice(ctx, { userId: users.faith, groupId: group.id, kind: "CONTRIBUTION" });
    const b = await requestInvoice(ctx, { userId: users.faith, groupId: group.id, kind: "CONTRIBUTION" });
    expect(b.id).toBe(a.id);
  });

  it("duplicate and out-of-order provider events credit once", async () => {
    const { ctx, provider } = makeCtx();
    const { group, users } = await umoja(ctx);
    const inv = await payAs(ctx, provider, users.wanjiku, group.id, { reconcile: false });
    const st = await provider.getInvoiceStatus({ paymentHash: inv.paymentHash! });
    applyProviderStatus(ctx, inv.id, { state: "PENDING" });
    applyProviderStatus(ctx, inv.id, st);
    applyProviderStatus(ctx, inv.id, st);
    await reconcileInvoice(ctx, inv.id);
    applyProviderStatus(ctx, inv.id, { state: "EXPIRED" });
    expect(count(ctx, "SELECT COUNT(*) AS n FROM contributions WHERE status = 'PAID'")).toBe(1);
    expect(count(ctx, "SELECT COUNT(*) AS n FROM receipts")).toBe(1);
    expect(getInvoice(ctx, inv.id, users.wanjiku).status).toBe("PAID");
  });

  it("simultaneous final contributions create exactly one payout intent", async () => {
    const { ctx, provider } = makeCtx();
    const { group, users } = await umoja(ctx);
    await payAs(ctx, provider, users.wanjiku, group.id);
    const f = await payAs(ctx, provider, users.faith, group.id, { reconcile: false });
    const a = await payAs(ctx, provider, users.amina, group.id, { reconcile: false });
    await Promise.all([reconcileInvoice(ctx, f.id), reconcileInvoice(ctx, a.id), reconcileInvoice(ctx, f.id), reconcileInvoice(ctx, a.id)]);
    expect(count(ctx, "SELECT COUNT(*) AS n FROM payouts")).toBe(1);
  });

  it("two workers racing never send twice", async () => {
    const { ctx, provider } = makeCtx();
    const { group, users } = await umoja(ctx);
    for (const u of [users.wanjiku, users.faith, users.amina]) await payAs(ctx, provider, u, group.id);
    await Promise.all([processPayouts(ctx, "w1"), processPayouts(ctx, "w2"), processPayouts(ctx, "w3")]);
    expect(count(ctx, "SELECT COUNT(*) AS n FROM demo_transfers WHERE request_id LIKE 'payout-%'")).toBe(1);
    expect(count(ctx, "SELECT COUNT(*) AS n FROM cycles WHERE round_number = 2")).toBe(1);
  });

  it("an expired invoice settled late after another invoice paid becomes an overpayment, not a second credit", async () => {
    const { ctx, provider, clock } = makeCtx();
    const { group, users } = await umoja(ctx);
    const old = await requestInvoice(ctx, { userId: users.faith, groupId: group.id, kind: "CONTRIBUTION" });
    clock.advance(16 * 60_000);
    expect(await reconcileInvoice(ctx, old.id)).toBe("EXPIRED");
    const fresh = await payAs(ctx, provider, users.faith, group.id);
    expect(fresh.id).not.toBe(old.id);
    provider.ensureWallet(`user:${users.faith}:BTC_SAT`, "payer", "BTC_SAT", 1_000_000n);
    provider.simulatePayment(old.paymentHash!, `user:${users.faith}:BTC_SAT`);
    await reconcileInvoice(ctx, old.id);
    expect(count(ctx, "SELECT COUNT(*) AS n FROM overpayments WHERE reason = 'DUPLICATE_SETTLEMENT'")).toBe(1);
    const c = ctx.db.prepare("SELECT settled_settlement_units AS s FROM contributions c JOIN members m ON m.id = c.member_id WHERE m.display_name = 'Faith'").get() as { s: number };
    expect(c.s).toBe(3220);
    expect(getInvoice(ctx, old.id, users.faith).creditedToContribution).toBe(false);
  });

  it("an underpayment leaves the obligation unresolved", async () => {
    const { ctx, provider } = makeCtx();
    const { group, users } = await umoja(ctx);
    const inv = await requestInvoice(ctx, { userId: users.wanjiku, groupId: group.id, kind: "CONTRIBUTION" });
    provider.ensureWallet("payer", "payer", "BTC_SAT", 1_000_000n);
    provider.simulatePayment(inv.paymentHash!, "payer", 1000n);
    await reconcileInvoice(ctx, inv.id);
    const row = getLedger(ctx, group.id, users.amina).contributions.find((c) => c.name === "Wanjiku")!;
    expect(row.status).not.toBe("PAID");
    expect(row.settledUnits).toBe("1000");
  });
});

describe("payout failure handling", () => {
  async function funded() {
    const env = makeCtx();
    const { group, users } = await umoja(env.ctx);
    for (const u of [users.wanjiku, users.faith, users.amina]) await payAs(env.ctx, env.provider, u, group.id);
    return { ...env, group, users };
  }
  const payout = (ctx: ReturnType<typeof makeCtx>["ctx"]) =>
    ctx.db.prepare("SELECT * FROM payouts").get() as { status: string; needs_operator_review: number; attempts: number };

  it("crash/timeout after submission becomes UNKNOWN, then reconciles to success without resending", async () => {
    const { ctx, provider } = await funded();
    provider.faults = { timeoutAfterSend: true };
    await processPayouts(ctx, "w1");
    expect(payout(ctx).status).toBe("UNKNOWN");
    provider.faults = {};
    await processPayouts(ctx, "w1"); // must not touch UNKNOWN
    await reconcileUnknownPayouts(ctx, "w1");
    expect(payout(ctx).status).toBe("SUCCEEDED");
    expect(count(ctx, "SELECT COUNT(*) AS n FROM demo_transfers WHERE request_id LIKE 'payout-%'")).toBe(1);
  });

  it("timeout before send is confirmed unsent by definitive lookup and retried once", async () => {
    const { ctx, provider } = await funded();
    provider.faults = { timeoutBeforeSend: true };
    await processPayouts(ctx, "w1");
    expect(payout(ctx).status).toBe("UNKNOWN");
    provider.faults = {};
    await reconcileUnknownPayouts(ctx, "w1");
    expect(payout(ctx).status).toBe("QUEUED");
    await processPayouts(ctx, "w1");
    expect(payout(ctx).status).toBe("SUCCEEDED");
    expect(count(ctx, "SELECT COUNT(*) AS n FROM demo_transfers WHERE request_id LIKE 'payout-%'")).toBe(1);
  });

  it("without definitive lookup an unknown payout stops for operator review", async () => {
    const { ctx, provider } = await funded();
    provider.faults = { timeoutBeforeSend: true };
    await processPayouts(ctx, "w1");
    provider.faults = {};
    Object.defineProperty(provider, "definitiveLookup", { value: false });
    provider.findPaymentByRequestId = async (): Promise<FoundPayment | null> => null;
    await reconcileUnknownPayouts(ctx, "w1");
    expect(payout(ctx)).toMatchObject({ status: "UNKNOWN", needs_operator_review: 1 });
    await processPayouts(ctx, "w1");
    expect(count(ctx, "SELECT COUNT(*) AS n FROM demo_transfers WHERE request_id LIKE 'payout-%'")).toBe(0);
    // Contributions are untouched and rotation does not advance.
    expect(count(ctx, "SELECT COUNT(*) AS n FROM contributions WHERE status = 'PAID'")).toBe(3);
    expect(count(ctx, "SELECT COUNT(*) AS n FROM cycles")).toBe(1);
  });

  it("retryable provider rejection backs off and retries", async () => {
    const { ctx, provider, clock } = await funded();
    provider.faults = { rejectRetryable: true };
    await processPayouts(ctx, "w1");
    expect(payout(ctx).status).toBe("QUEUED");
    provider.faults = {};
    await processPayouts(ctx, "w1");
    expect(payout(ctx).status).toBe("QUEUED"); // backoff not elapsed
    clock.advance(60_000);
    await processPayouts(ctx, "w1");
    expect(payout(ctx).status).toBe("SUCCEEDED");
  });

  it("a worker lease that expires mid-flight is treated as UNKNOWN, never resent blindly", async () => {
    const { ctx, clock } = await funded();
    ctx.db.prepare("UPDATE payouts SET status = 'PROCESSING', lease_until = ?, attempts = 1").run(new Date(clock.t + 1000).toISOString());
    clock.advance(120_000);
    await processPayouts(ctx, "w2");
    expect(payout(ctx).status).toBe("UNKNOWN");
  });
});

describe("authorization and diaspora", () => {
  it("non-members cannot read ledger, invoice or receipt, even with valid ids", async () => {
    const { ctx, provider } = makeCtx();
    const { group, users } = await umoja(ctx);
    const inv = await payAs(ctx, provider, users.wanjiku, group.id);
    const stranger = user(ctx, "Stranger");
    const receiptId = (ctx.db.prepare("SELECT id FROM receipts").get() as { id: string }).id;
    for (const fn of [() => getLedger(ctx, group.id, stranger), () => getInvoice(ctx, inv.id, stranger), () => getReceipt(ctx, receiptId, stranger)]) {
      expect(fn).toThrow(DomainError);
    }
    await expect(requestInvoice(ctx, { userId: stranger, groupId: group.id, kind: "CONTRIBUTION" })).rejects.toThrow(DomainError);
  });

  it("members cannot open someone else's contribution invoice", async () => {
    const { ctx } = makeCtx();
    const { group, users } = await umoja(ctx);
    const faithMember = (ctx.db.prepare("SELECT id FROM members WHERE display_name = 'Faith'").get() as { id: string }).id;
    await expect(requestInvoice(ctx, { userId: users.amina, groupId: group.id, kind: "CONTRIBUTION", memberId: faithMember })).rejects.toThrow(/own contribution/);
  });

  it("diaspora payer covers an existing obligation with separate attribution, never twice", async () => {
    const { ctx, provider } = makeCtx();
    const { group, users } = await umoja(ctx);
    const aminaMember = (ctx.db.prepare("SELECT id FROM members WHERE display_name = 'Amina Otieno'").get() as { id: string }).id;
    const inv = await createDiasporaInvoice(ctx, { userId: users.amina, groupId: group.id, memberId: aminaMember, payerName: "Njeri", payerCity: "London" });
    expect(inv.diaspora?.sourceMinor).toBe("3000");
    provider.ensureWallet("njeri", "Njeri", "BTC_SAT", 1_000_000n);
    provider.simulatePayment(inv.paymentHash!, "njeri");
    await reconcileInvoice(ctx, inv.id);
    const row = getLedger(ctx, group.id, users.amina).contributions.find((c) => c.name === "Amina Otieno")!;
    expect(row).toMatchObject({ status: "PAID", payerLabel: "Njeri (London)" });
    const r = getReceipt(ctx, row.receiptId!, users.amina);
    expect(r.snapshot).toMatchObject({ kind: "DIASPORA", payerName: "Njeri (London)", beneficiaryName: "Amina Otieno" });
    expect(r.snapshot.diaspora?.benchmark).toMatchObject({ lowMinor: "102", highMinor: "132" });
    await expect(
      createDiasporaInvoice(ctx, { userId: users.amina, groupId: group.id, memberId: aminaMember, payerName: "Njeri", payerCity: "London" }),
    ).rejects.toThrow(/already paid/);
    expect(count(ctx, "SELECT COUNT(*) AS n FROM contributions")).toBe(3);
  });

  it("audit log and receipts are append-only at the database level", async () => {
    const { ctx, provider } = makeCtx();
    const { group, users } = await umoja(ctx);
    await payAs(ctx, provider, users.wanjiku, group.id);
    expect(() => ctx.db.exec("UPDATE ledger_events SET type = 'X'")).toThrow(/append-only/);
    expect(() => ctx.db.exec("DELETE FROM ledger_events")).toThrow(/append-only/);
    expect(() => ctx.db.exec("UPDATE receipts SET snapshot_json = '{}'")).toThrow(/immutable/);
    expect(verifyChain(ctx.db, group.id).ok).toBe(true);
  });
});
