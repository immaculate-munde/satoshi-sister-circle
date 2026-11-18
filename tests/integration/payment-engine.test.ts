import { describe, expect, it } from "vitest";
import { exec, many, one, run } from "@/lib/db";
import { getLedger, listChamas } from "@/lib/domain/chamas";
import { type Ctx, DomainError } from "@/lib/domain/context";
import { createDiasporaInvoice } from "@/lib/domain/diaspora";
import { applyProviderStatus, getInvoice, reconcileInvoice, requestInvoice } from "@/lib/domain/invoices";
import { verifyChain } from "@/lib/domain/ledger";
import { processPayouts, reconcileUnknownPayouts } from "@/lib/domain/payouts";
import { getReceipt } from "@/lib/domain/receipts";
import type { FoundPayment } from "@/lib/payments/provider";
import { count, makeCtx, payAs, umoja, user } from "./helpers";

const memberWallet = async (ctx: Ctx, groupId: string, name: string) =>
  (await one<{ w: string }>(ctx.db, "SELECT verified_destination_ref AS w FROM members WHERE group_id = :g AND display_name = :n", { g: groupId, n: name }))!.w;

describe("contribution -> automatic payout", () => {
  it("three verified settlements produce exactly one payout and one payout receipt", async () => {
    const { ctx, provider } = await makeCtx();
    const { group, users } = await umoja(ctx);
    const wanjikuWallet = await memberWallet(ctx, group.id, "Wanjiku");

    for (const [i, u] of [users.wanjiku, users.faith].entries()) {
      await payAs(ctx, provider, u, group.id);
      expect((await getLedger(ctx, group.id, users.amina)).cycle.paidCount).toBe(i + 1);
    }
    expect(await count(ctx, "SELECT COUNT(*) AS n FROM payouts")).toBe(0);
    await payAs(ctx, provider, users.amina, group.id);
    expect(await count(ctx, "SELECT COUNT(*) AS n FROM payouts")).toBe(1);

    await processPayouts(ctx, "w1");
    await processPayouts(ctx, "w1");
    const payout = (await one<{ status: string; principal_units: number; id: string }>(ctx.db, "SELECT * FROM payouts"))!;
    expect(payout.status).toBe("SUCCEEDED");
    expect(payout.principal_units).toBe(9660);
    expect(await provider.getBalance(wanjikuWallet)).toBe("9660");
    expect(await count(ctx, "SELECT COUNT(*) AS n FROM demo_transfers WHERE request_id LIKE 'payout-%'")).toBe(1);

    const receipts = await many<{ id: string; kind: string; receipt_number: string }>(ctx.db, "SELECT id, kind, receipt_number FROM receipts ORDER BY receipt_number");
    expect(receipts.map((r) => r.receipt_number)).toEqual(["CHM-0001-R1-01", "CHM-0001-R1-02", "CHM-0001-R1-03", "CHM-0001-R1-PO"]);
    const po = await getReceipt(ctx, receipts[3].id, users.wanjiku);
    expect(po.snapshot.totalKesMinor).toBe("1500000");
    expect(po.integrity).toBe("VERIFIED");
    const c3 = await getReceipt(ctx, receipts[2].id, users.amina);
    expect(c3.snapshot.totalKesMinor).toBe("500000");
    expect(c3.snapshot.principal.units).toBe("3220");

    // Rotation advanced only after confirmed success.
    const ledger = await getLedger(ctx, group.id, users.amina);
    expect(ledger.cycle.round).toBe(2);
    expect(ledger.cycle.recipient.name).toBe("Faith");
    expect((await verifyChain(ctx.db, group.id)).ok).toBe(true);
    expect((await listChamas(ctx, users.amina)).totals.btcSats).toBe("3220");
  });

  it("works the same for a USD-stable chama, in cents, without mixing assets", async () => {
    const { ctx, provider } = await makeCtx();
    const { group, users } = await umoja(ctx, "USD_CENT");
    for (const u of [users.wanjiku, users.faith, users.amina]) await payAs(ctx, provider, u, group.id);
    await processPayouts(ctx, "w1");
    const p = await one<Record<string, unknown>>(ctx.db, "SELECT asset, principal_units, status FROM payouts");
    expect(p).toMatchObject({ asset: "USD_CENT", principal_units: 3870 * 3, status: "SUCCEEDED" });
    expect((await listChamas(ctx, users.amina)).totals).toMatchObject({ btcSats: "0", usdCents: "3870" });
  });

  it("an invoice click, copy or QR alone never marks anything paid", async () => {
    const { ctx } = await makeCtx();
    const { group, users } = await umoja(ctx);
    const inv = await requestInvoice(ctx, { userId: users.wanjiku, groupId: group.id, kind: "CONTRIBUTION" });
    expect(await reconcileInvoice(ctx, inv.id)).toBe("PENDING");
    expect((await getLedger(ctx, group.id, users.amina)).cycle.paidCount).toBe(0);
  });

  it("reuses an open invoice instead of creating duplicates (refresh/back navigation)", async () => {
    const { ctx } = await makeCtx();
    const { group, users } = await umoja(ctx);
    const a = await requestInvoice(ctx, { userId: users.faith, groupId: group.id, kind: "CONTRIBUTION" });
    const b = await requestInvoice(ctx, { userId: users.faith, groupId: group.id, kind: "CONTRIBUTION" });
    expect(b.id).toBe(a.id);
  });

  it("duplicate and out-of-order provider events credit once", async () => {
    const { ctx, provider } = await makeCtx();
    const { group, users } = await umoja(ctx);
    const inv = await payAs(ctx, provider, users.wanjiku, group.id, { reconcile: false });
    const st = await provider.getInvoiceStatus({ paymentHash: inv.paymentHash! });
    await applyProviderStatus(ctx, inv.id, { state: "PENDING" });
    await applyProviderStatus(ctx, inv.id, st);
    await applyProviderStatus(ctx, inv.id, st);
    await reconcileInvoice(ctx, inv.id);
    await applyProviderStatus(ctx, inv.id, { state: "EXPIRED" });
    expect(await count(ctx, "SELECT COUNT(*) AS n FROM contributions WHERE status = 'PAID'")).toBe(1);
    expect(await count(ctx, "SELECT COUNT(*) AS n FROM receipts")).toBe(1);
    expect((await getInvoice(ctx, inv.id, users.wanjiku)).status).toBe("PAID");
  });

  it("simultaneous final contributions create exactly one payout intent", async () => {
    const { ctx, provider } = await makeCtx();
    const { group, users } = await umoja(ctx);
    await payAs(ctx, provider, users.wanjiku, group.id);
    const f = await payAs(ctx, provider, users.faith, group.id, { reconcile: false });
    const a = await payAs(ctx, provider, users.amina, group.id, { reconcile: false });
    await Promise.all([reconcileInvoice(ctx, f.id), reconcileInvoice(ctx, a.id), reconcileInvoice(ctx, f.id), reconcileInvoice(ctx, a.id)]);
    expect(await count(ctx, "SELECT COUNT(*) AS n FROM payouts")).toBe(1);
  });

  it("two workers racing never send twice", async () => {
    const { ctx, provider } = await makeCtx();
    const { group, users } = await umoja(ctx);
    for (const u of [users.wanjiku, users.faith, users.amina]) await payAs(ctx, provider, u, group.id);
    await Promise.all([processPayouts(ctx, "w1"), processPayouts(ctx, "w2"), processPayouts(ctx, "w3")]);
    expect(await count(ctx, "SELECT COUNT(*) AS n FROM demo_transfers WHERE request_id LIKE 'payout-%'")).toBe(1);
    expect(await count(ctx, "SELECT COUNT(*) AS n FROM cycles WHERE round_number = 2")).toBe(1);
  });

  it("an expired invoice settled late after another invoice paid becomes an overpayment, not a second credit", async () => {
    const { ctx, provider, clock } = await makeCtx();
    const { group, users } = await umoja(ctx);
    const old = await requestInvoice(ctx, { userId: users.faith, groupId: group.id, kind: "CONTRIBUTION" });
    clock.advance(16 * 60_000);
    expect(await reconcileInvoice(ctx, old.id)).toBe("EXPIRED");
    const fresh = await payAs(ctx, provider, users.faith, group.id);
    expect(fresh.id).not.toBe(old.id);
    await provider.ensureWallet(`user:${users.faith}:BTC_SAT`, "payer", "BTC_SAT", 1_000_000n);
    await provider.simulatePayment(old.paymentHash!, `user:${users.faith}:BTC_SAT`);
    await reconcileInvoice(ctx, old.id);
    expect(await count(ctx, "SELECT COUNT(*) AS n FROM overpayments WHERE reason = 'DUPLICATE_SETTLEMENT'")).toBe(1);
    const c = (await one<{ s: number }>(ctx.db, "SELECT settled_settlement_units AS s FROM contributions c JOIN members m ON m.id = c.member_id WHERE m.display_name = 'Faith'"))!;
    expect(c.s).toBe(3220);
    expect((await getInvoice(ctx, old.id, users.faith)).creditedToContribution).toBe(false);
  });

  it("an underpayment leaves the obligation unresolved", async () => {
    const { ctx, provider } = await makeCtx();
    const { group, users } = await umoja(ctx);
    const inv = await requestInvoice(ctx, { userId: users.wanjiku, groupId: group.id, kind: "CONTRIBUTION" });
    await provider.ensureWallet("payer", "payer", "BTC_SAT", 1_000_000n);
    await provider.simulatePayment(inv.paymentHash!, "payer", 1000n);
    await reconcileInvoice(ctx, inv.id);
    const row = (await getLedger(ctx, group.id, users.amina)).contributions.find((c) => c.name === "Wanjiku")!;
    expect(row.status).not.toBe("PAID");
    expect(row.settledUnits).toBe("1000");
  });
});

describe("payout failure handling", () => {
  async function funded() {
    const env = await makeCtx();
    const { group, users } = await umoja(env.ctx);
    for (const u of [users.wanjiku, users.faith, users.amina]) await payAs(env.ctx, env.provider, u, group.id);
    return { ...env, group, users };
  }
  const payout = async (ctx: Ctx) =>
    (await one<{ status: string; needs_operator_review: number; attempts: number }>(ctx.db, "SELECT * FROM payouts"))!;

  it("crash/timeout after submission becomes UNKNOWN, then reconciles to success without resending", async () => {
    const { ctx, provider } = await funded();
    provider.faults = { timeoutAfterSend: true };
    await processPayouts(ctx, "w1");
    expect((await payout(ctx)).status).toBe("UNKNOWN");
    provider.faults = {};
    await processPayouts(ctx, "w1"); // must not touch UNKNOWN
    await reconcileUnknownPayouts(ctx, "w1");
    expect((await payout(ctx)).status).toBe("SUCCEEDED");
    expect(await count(ctx, "SELECT COUNT(*) AS n FROM demo_transfers WHERE request_id LIKE 'payout-%'")).toBe(1);
  });

  it("timeout before send is confirmed unsent by definitive lookup and retried once", async () => {
    const { ctx, provider } = await funded();
    provider.faults = { timeoutBeforeSend: true };
    await processPayouts(ctx, "w1");
    expect((await payout(ctx)).status).toBe("UNKNOWN");
    provider.faults = {};
    await reconcileUnknownPayouts(ctx, "w1");
    expect((await payout(ctx)).status).toBe("QUEUED");
    await processPayouts(ctx, "w1");
    expect((await payout(ctx)).status).toBe("SUCCEEDED");
    expect(await count(ctx, "SELECT COUNT(*) AS n FROM demo_transfers WHERE request_id LIKE 'payout-%'")).toBe(1);
  });

  it("without definitive lookup an unknown payout stops for operator review", async () => {
    const { ctx, provider } = await funded();
    provider.faults = { timeoutBeforeSend: true };
    await processPayouts(ctx, "w1");
    provider.faults = {};
    Object.defineProperty(provider, "definitiveLookup", { value: false });
    provider.findPaymentByRequestId = async (): Promise<FoundPayment | null> => null;
    await reconcileUnknownPayouts(ctx, "w1");
    expect(await payout(ctx)).toMatchObject({ status: "UNKNOWN", needs_operator_review: 1 });
    await processPayouts(ctx, "w1");
    expect(await count(ctx, "SELECT COUNT(*) AS n FROM demo_transfers WHERE request_id LIKE 'payout-%'")).toBe(0);
    // Contributions are untouched and rotation does not advance.
    expect(await count(ctx, "SELECT COUNT(*) AS n FROM contributions WHERE status = 'PAID'")).toBe(3);
    expect(await count(ctx, "SELECT COUNT(*) AS n FROM cycles")).toBe(1);
  });

  it("retryable provider rejection backs off and retries", async () => {
    const { ctx, provider, clock } = await funded();
    provider.faults = { rejectRetryable: true };
    await processPayouts(ctx, "w1");
    expect((await payout(ctx)).status).toBe("QUEUED");
    provider.faults = {};
    await processPayouts(ctx, "w1");
    expect((await payout(ctx)).status).toBe("QUEUED"); // backoff not elapsed
    clock.advance(60_000);
    await processPayouts(ctx, "w1");
    expect((await payout(ctx)).status).toBe("SUCCEEDED");
  });

  it("a worker lease that expires mid-flight is treated as UNKNOWN, never resent blindly", async () => {
    const { ctx, clock } = await funded();
    await run(ctx.db, "UPDATE payouts SET status = 'PROCESSING', lease_until = :l, attempts = 1", { l: new Date(clock.t + 1000).toISOString() });
    clock.advance(120_000);
    await processPayouts(ctx, "w2");
    expect((await payout(ctx)).status).toBe("UNKNOWN");
  });
});

describe("authorization and diaspora", () => {
  it("non-members cannot read ledger, invoice or receipt, even with valid ids", async () => {
    const { ctx, provider } = await makeCtx();
    const { group, users } = await umoja(ctx);
    const inv = await payAs(ctx, provider, users.wanjiku, group.id);
    const stranger = await user(ctx, "Stranger");
    const receiptId = (await one<{ id: string }>(ctx.db, "SELECT id FROM receipts"))!.id;
    for (const fn of [() => getLedger(ctx, group.id, stranger), () => getInvoice(ctx, inv.id, stranger), () => getReceipt(ctx, receiptId, stranger)]) {
      await expect(fn()).rejects.toThrow(DomainError);
    }
    await expect(requestInvoice(ctx, { userId: stranger, groupId: group.id, kind: "CONTRIBUTION" })).rejects.toThrow(DomainError);
  });

  it("members cannot open someone else's contribution invoice", async () => {
    const { ctx } = await makeCtx();
    const { group, users } = await umoja(ctx);
    const faithMember = (await one<{ id: string }>(ctx.db, "SELECT id FROM members WHERE display_name = 'Faith'"))!.id;
    await expect(requestInvoice(ctx, { userId: users.amina, groupId: group.id, kind: "CONTRIBUTION", memberId: faithMember })).rejects.toThrow(/own contribution/);
  });

  it("diaspora payer covers an existing obligation with separate attribution, never twice", async () => {
    const { ctx, provider } = await makeCtx();
    const { group, users } = await umoja(ctx);
    const aminaMember = (await one<{ id: string }>(ctx.db, "SELECT id FROM members WHERE display_name = 'Amina Otieno'"))!.id;
    const inv = await createDiasporaInvoice(ctx, { userId: users.amina, groupId: group.id, memberId: aminaMember, payerName: "Njeri", payerCity: "London" });
    expect(inv.diaspora?.sourceMinor).toBe("3000");
    await provider.ensureWallet("njeri", "Njeri", "BTC_SAT", 1_000_000n);
    await provider.simulatePayment(inv.paymentHash!, "njeri");
    await reconcileInvoice(ctx, inv.id);
    const row = (await getLedger(ctx, group.id, users.amina)).contributions.find((c) => c.name === "Amina Otieno")!;
    expect(row).toMatchObject({ status: "PAID", payerLabel: "Njeri (London)" });
    const r = await getReceipt(ctx, row.receiptId!, users.amina);
    expect(r.snapshot).toMatchObject({ kind: "DIASPORA", payerName: "Njeri (London)", beneficiaryName: "Amina Otieno" });
    expect(r.snapshot.diaspora?.benchmark).toMatchObject({ lowMinor: "102", highMinor: "132" });
    await expect(
      createDiasporaInvoice(ctx, { userId: users.amina, groupId: group.id, memberId: aminaMember, payerName: "Njeri", payerCity: "London" }),
    ).rejects.toThrow(/already paid/);
    expect(await count(ctx, "SELECT COUNT(*) AS n FROM contributions")).toBe(3);
  });

  it("audit log and receipts are append-only at the database level", async () => {
    const { ctx, provider } = await makeCtx();
    const { group, users } = await umoja(ctx);
    await payAs(ctx, provider, users.wanjiku, group.id);
    await expect(exec(ctx.db, "UPDATE ledger_events SET type = 'X'")).rejects.toThrow(/append-only/);
    await expect(exec(ctx.db, "DELETE FROM ledger_events")).rejects.toThrow(/append-only/);
    await expect(exec(ctx.db, "UPDATE receipts SET snapshot_json = '{}'")).rejects.toThrow(/immutable/);
    expect((await verifyChain(ctx.db, group.id)).ok).toBe(true);
  });
});
