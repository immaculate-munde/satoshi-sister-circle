import { NextResponse } from "next/server";
import { api, authed, rateLimit } from "@/lib/api/http";
import { config } from "@/lib/config";
import { DomainError } from "@/lib/domain/context";
import { getInvoice } from "@/lib/domain/invoices";
import { DemoProvider } from "@/lib/payments/demo";
import { ProviderRejectedError } from "@/lib/payments/provider";

/**
 * Pay from a member-owned wallet. Only the DEMO provider supports this, as a clearly labelled
 * simulation that moves demo balances inside the simulated provider. The app still learns about the
 * payment only by asking the provider (GET /api/invoices/:id or the worker), never from this click.
 */
export const POST = api<{ invoiceId: string }>(
  async ({ ctx, req, params }) => {
    const user = await authed(ctx);
    rateLimit(req, "pay", 10, 60_000, user.id);
    const cfg = config();
    const inv = getInvoice(ctx, params.invoiceId, user.id);
    if (!cfg.allowSimulatedPayments || !(ctx.provider instanceof DemoProvider)) {
      throw new DomainError(
        "MEMBER_WALLET_UNAVAILABLE",
        "Paying from an in-app member wallet is not available. Scan the QR or copy the invoice into your Lightning wallet.",
        409,
      );
    }
    if (!inv.paymentHash) throw new DomainError("INVOICE_NOT_READY", "Invoice is not ready yet", 409, true);
    const diaspora = inv.kind === "DIASPORA";
    const payerWallet = diaspora ? `payer:diaspora:${inv.asset}` : `user:${user.id}:${inv.asset}`;
    ctx.provider.ensureWallet(payerWallet, diaspora ? "Diaspora test payer" : `${user.displayName} test wallet`, inv.asset, 1_000_000n);
    try {
      const r = ctx.provider.simulatePayment(inv.paymentHash, payerWallet);
      return NextResponse.json({ simulated: true, submitted: !r.alreadyPaid });
    } catch (e) {
      if (e instanceof ProviderRejectedError) throw new DomainError("SIMULATION_REJECTED", e.message, 409);
      throw e;
    }
  },
  { mutation: true },
);
