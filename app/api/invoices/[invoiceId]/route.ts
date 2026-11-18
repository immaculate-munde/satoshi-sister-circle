import { NextResponse } from "next/server";
import { api, authed } from "@/lib/api/http";
import { getInvoice, reconcileInvoice } from "@/lib/domain/invoices";

const lastCheck = new Map<string, number>();

/** Canonical invoice state. Open invoices are re-checked with the provider (throttled) before answering. */
export const GET = api<{ invoiceId: string }>(async ({ ctx, params }) => {
  const user = await authed(ctx);
  const view = await getInvoice(ctx, params.invoiceId, user.id);
  if (["PENDING", "CREATING", "UNKNOWN", "EXPIRED"].includes(view.status)) {
    const t = lastCheck.get(view.id) ?? 0;
    if (Date.now() - t > 1500) {
      lastCheck.set(view.id, Date.now());
      try {
        await reconcileInvoice(ctx, view.id);
      } catch {
        /* provider hiccup: the worker reconciler will catch up */
      }
      return NextResponse.json(await getInvoice(ctx, params.invoiceId, user.id));
    }
  }
  return NextResponse.json(view);
});
