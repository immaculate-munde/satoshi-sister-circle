import { createHash, randomBytes } from "node:crypto";
import { type Db, id, many, nowIso, one, run, tx } from "../db";
import type { Asset } from "../money";
import {
  type CreatedInvoice,
  type FoundPayment,
  type InvoiceStatus,
  type PaymentState,
  type PaymentsProvider,
  ProviderRejectedError,
  ProviderUnknownOutcomeError,
  type SendResult,
} from "./provider";

/**
 * SIMULATED custodial provider. Keeps its own books in demo_* tables so the application still has
 * to ask "the provider" whether money arrived. No real Lightning payment ever happens here, and the
 * payment requests it issues are deliberately NOT valid BOLT11 strings, so no real wallet can pay them.
 */
export interface DemoFaults {
  /** Throw an unknown-outcome error AFTER recording the transfer (simulates timeout after send). */
  timeoutAfterSend?: boolean;
  /** Throw an unknown-outcome error BEFORE recording the transfer (simulates timeout before send). */
  timeoutBeforeSend?: boolean;
  /** Reject the transfer with a retryable error. */
  rejectRetryable?: boolean;
}

interface DemoInvoiceRow {
  payment_hash: string;
  provider_invoice_id: string;
  wallet_id: string;
  asset: Asset;
  amount_units: number;
  status: "PENDING" | "PAID" | "EXPIRED";
  paid_units: number | null;
  payment_request: string;
  expires_at: string;
  paid_at: string | null;
  request_id: string;
}

export const DEMO_NETWORK = "DEMO (simulated, no real funds)";

export class DemoProvider implements PaymentsProvider {
  readonly name = "demo" as const;
  readonly network = DEMO_NETWORK;
  readonly definitiveLookup = true;
  faults: DemoFaults = {};

  constructor(
    private readonly db: Db,
    private readonly now: () => Date = () => new Date(),
  ) {}

  collectionWalletId(groupAccountRef: string, asset: Asset): string {
    return `${groupAccountRef}:${asset}`;
  }

  async ensureWallet(walletId: string, ownerLabel: string, asset: Asset, initialBalance = 0n) {
    await run(
      this.db,
      `INSERT INTO demo_wallets (id, owner_label, asset, balance_units, created_at)
       VALUES (:id, :label, :asset, :bal, :now) ON CONFLICT(id) DO NOTHING`,
      { id: walletId, label: ownerLabel, asset, bal: Number(initialBalance), now: nowIso(this.now()) },
    );
  }

  private toCreated(r: DemoInvoiceRow): CreatedInvoice {
    return {
      providerId: r.provider_invoice_id,
      paymentHash: r.payment_hash,
      bolt11: r.payment_request,
      expiresAt: r.expires_at,
      amount: String(r.amount_units),
      asset: r.asset,
    };
  }

  async createInvoice(input: {
    walletId: string;
    asset: Asset;
    amount: string;
    memo: string;
    expiresInSeconds: number;
    requestId: string;
  }): Promise<CreatedInvoice> {
    const existing = await this.findInvoiceByRequestId(input.requestId);
    if (existing) return existing;
    const wallet = await one<{ asset: Asset }>(this.db, "SELECT asset FROM demo_wallets WHERE id = :id", { id: input.walletId });
    if (!wallet) throw new ProviderRejectedError("Unknown demo wallet", false);
    if (wallet.asset !== input.asset) throw new ProviderRejectedError("Wallet asset mismatch", false);
    const preimage = randomBytes(32);
    const paymentHash = createHash("sha256").update(preimage).digest("hex");
    const now = this.now();
    const expiresAt = new Date(now.getTime() + input.expiresInSeconds * 1000).toISOString();
    const unit = input.asset === "BTC_SAT" ? "sat" : "usdcent";
    // Intentionally not BOLT11. Prefix makes it obvious in QR scanners and clipboard.
    const paymentRequest = `chama-demo:${paymentHash}?amount=${input.amount}${unit}&network=demo&note=SIMULATED-NOT-A-LIGHTNING-INVOICE`;
    const row = {
      hash: paymentHash,
      pid: `demo_inv_${paymentHash.slice(0, 16)}`,
      wallet: input.walletId,
      asset: input.asset,
      amount: Number(input.amount),
      memo: input.memo,
      rid: input.requestId,
      pr: paymentRequest,
      exp: expiresAt,
      now: now.toISOString(),
    };
    await run(
      this.db,
      `INSERT INTO demo_invoices (payment_hash, provider_invoice_id, wallet_id, asset, amount_units, memo, request_id,
         payment_request, status, expires_at, created_at)
       VALUES (:hash, :pid, :wallet, :asset, :amount, :memo, :rid, :pr, 'PENDING', :exp, :now)`,
      row,
    );
    return {
      providerId: row.pid,
      paymentHash,
      bolt11: paymentRequest,
      expiresAt,
      amount: input.amount,
      asset: input.asset,
    };
  }

  async findInvoiceByRequestId(requestId: string): Promise<CreatedInvoice | null> {
    const r = await one<DemoInvoiceRow>(this.db, "SELECT * FROM demo_invoices WHERE request_id = :rid", { rid: requestId });
    return r ? this.toCreated(r) : null;
  }

  async getInvoiceStatus(invoice: { paymentHash: string }): Promise<InvoiceStatus> {
    const r = await one<DemoInvoiceRow>(this.db, "SELECT * FROM demo_invoices WHERE payment_hash = :h", {
      h: invoice.paymentHash,
    });
    if (!r) return { state: "UNKNOWN" };
    if (r.status === "PAID") {
      return {
        state: "PAID",
        paidAmount: String(r.paid_units ?? r.amount_units),
        walletId: r.wallet_id,
        paidAt: r.paid_at ?? undefined,
        proofRef: `demo:${r.payment_hash}`,
      };
    }
    if (r.status === "PENDING" && new Date(r.expires_at) <= this.now()) return { state: "EXPIRED" };
    return { state: r.status };
  }

  async watchInvoice(
    invoice: { paymentHash: string; bolt11: string; walletId: string },
    onUpdate: (s: PaymentState) => void,
  ): Promise<() => void> {
    let last: PaymentState | null = null;
    const timer = setInterval(async () => {
      const s = (await this.getInvoiceStatus(invoice)).state;
      if (s !== last) {
        last = s;
        onUpdate(s);
      }
    }, 1000);
    return () => clearInterval(timer);
  }

  /**
   * SIMULATION ONLY: a test wallet pays a demo invoice. Moves demo balances inside the demo
   * provider's books. Expired invoices can still be paid late (to exercise late-settlement handling).
   */
  async simulatePayment(paymentHash: string, payerWalletId: string, amountOverride?: bigint) {
    return await tx(this.db, async () => {
      const r = await one<DemoInvoiceRow>(this.db, "SELECT * FROM demo_invoices WHERE payment_hash = :h", { h: paymentHash });
      if (!r) throw new ProviderRejectedError("Unknown demo invoice", false);
      if (r.status === "PAID") return { alreadyPaid: true };
      const amount = amountOverride ?? BigInt(r.amount_units);
      const payer = await one<{ balance_units: number; asset: Asset }>(
        this.db,
        "SELECT balance_units, asset FROM demo_wallets WHERE id = :id",
        { id: payerWalletId },
      );
      if (!payer) throw new ProviderRejectedError("Unknown payer test wallet", false);
      if (payer.asset !== r.asset) throw new ProviderRejectedError("Payer wallet asset mismatch", false);
      if (BigInt(payer.balance_units) < amount) throw new ProviderRejectedError("Test wallet balance too low", false);
      const now = nowIso(this.now());
      await run(this.db, "UPDATE demo_wallets SET balance_units = balance_units - :a WHERE id = :id", {
        a: Number(amount),
        id: payerWalletId,
      });
      await run(this.db, "UPDATE demo_wallets SET balance_units = balance_units + :a WHERE id = :id", {
        a: Number(amount),
        id: r.wallet_id,
      });
      await run(
        this.db,
        "UPDATE demo_invoices SET status = 'PAID', paid_units = :a, paid_at = :now WHERE payment_hash = :h",
        { a: Number(amount), now, h: paymentHash },
      );
      await run(
        this.db,
        `INSERT INTO demo_transfers (id, request_id, source_wallet_id, destination_wallet_id, asset, amount_units,
           fee_units, memo, payment_hash, created_at)
         VALUES (:id, :rid, :src, :dst, :asset, :a, 0, 'invoice payment', :h, :now)`,
        {
          id: id(),
          rid: `invoice-pay:${paymentHash}`,
          src: payerWalletId,
          dst: r.wallet_id,
          asset: r.asset,
          a: Number(amount),
          h: paymentHash,
          now,
        },
      );
      return { alreadyPaid: false };
    });
  }

  async payInternal(input: {
    sourceWalletId: string;
    destinationWalletId: string;
    asset: Asset;
    amount: string;
    requestId: string;
    memo: string;
  }): Promise<SendResult> {
    if (this.faults.timeoutBeforeSend) throw new ProviderUnknownOutcomeError("Simulated timeout before send");
    if (this.faults.rejectRetryable) throw new ProviderRejectedError("Simulated rate limit", true, 1);
    const existing = await one<{ id: string; fee_units: number }>(
      this.db,
      "SELECT id, fee_units FROM demo_transfers WHERE request_id = :rid",
      { rid: input.requestId },
    );
    if (existing) return { providerPaymentId: existing.id, status: "SUCCEEDED", fee: String(existing.fee_units) };
    const transferId = `demo_tx_${id()}`;
    await tx(this.db, async () => {
      const src = await one<{ balance_units: number; asset: Asset }>(
        this.db,
        "SELECT balance_units, asset FROM demo_wallets WHERE id = :id",
        { id: input.sourceWalletId },
      );
      const dst = await one<{ asset: Asset }>(this.db, "SELECT asset FROM demo_wallets WHERE id = :id", {
        id: input.destinationWalletId,
      });
      if (!src || !dst) throw new ProviderRejectedError("Unknown wallet", false);
      if (src.asset !== input.asset || dst.asset !== input.asset) {
        throw new ProviderRejectedError("Cross-asset transfer not supported", false);
      }
      const amount = BigInt(input.amount);
      if (BigInt(src.balance_units) < amount) throw new ProviderRejectedError("Insufficient balance", true, 30);
      await run(this.db, "UPDATE demo_wallets SET balance_units = balance_units - :a WHERE id = :id", {
        a: Number(amount),
        id: input.sourceWalletId,
      });
      await run(this.db, "UPDATE demo_wallets SET balance_units = balance_units + :a WHERE id = :id", {
        a: Number(amount),
        id: input.destinationWalletId,
      });
      await run(
        this.db,
        `INSERT INTO demo_transfers (id, request_id, source_wallet_id, destination_wallet_id, asset, amount_units,
           fee_units, memo, created_at)
         VALUES (:id, :rid, :src, :dst, :asset, :a, 0, :memo, :now)`,
        {
          id: transferId,
          rid: input.requestId,
          src: input.sourceWalletId,
          dst: input.destinationWalletId,
          asset: input.asset,
          a: Number(amount),
          memo: input.memo,
          now: nowIso(this.now()),
        },
      );
    });
    if (this.faults.timeoutAfterSend) throw new ProviderUnknownOutcomeError("Simulated timeout after send");
    return { providerPaymentId: transferId, status: "SUCCEEDED", fee: "0" };
  }

  async payInvoice(): Promise<SendResult> {
    throw new ProviderRejectedError("External Lightning payouts are not part of the demo provider", false);
  }

  async findPaymentByRequestId(input: { requestId: string }): Promise<FoundPayment | null> {
    const t = await one<{ id: string; amount_units: number; fee_units: number; destination_wallet_id: string }>(
      this.db,
      "SELECT * FROM demo_transfers WHERE request_id = :rid",
      { rid: input.requestId },
    );
    if (!t) return null;
    return {
      providerPaymentId: t.id,
      status: "SUCCEEDED",
      amount: String(t.amount_units),
      fee: String(t.fee_units),
      destinationWalletId: t.destination_wallet_id,
    };
  }

  async listTransactions(walletId: string) {
    const transactions = await many(
      this.db,
      `SELECT * FROM demo_transfers WHERE source_wallet_id = :w OR destination_wallet_id = :w ORDER BY created_at DESC LIMIT 100`,
      { w: walletId },
    );
    return { transactions };
  }

  async resolveDestination(input: { reference: string; asset: Asset }) {
    const w = await one<{ id: string; owner_label: string; asset: Asset }>(
      this.db,
      "SELECT * FROM demo_wallets WHERE id = :id",
      { id: input.reference },
    );
    if (!w) throw new ProviderRejectedError("Destination wallet not found", false);
    if (w.asset !== input.asset) throw new ProviderRejectedError("Destination wallet is in a different asset", false);
    return { walletId: w.id, asset: w.asset, label: `${w.owner_label} (demo wallet)` };
  }

  async getBalance(walletId: string): Promise<string> {
    const w = await one<{ balance_units: number }>(this.db, "SELECT balance_units FROM demo_wallets WHERE id = :id", {
      id: walletId,
    });
    return String(w?.balance_units ?? 0);
  }
}
