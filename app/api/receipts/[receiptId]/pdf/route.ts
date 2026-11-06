import { api, authed } from "@/lib/api/http";
import { getReceipt } from "@/lib/domain/receipts";
import { renderReceiptPdf } from "@/features/receipts/pdf";

export const GET = api<{ receiptId: string }>(async ({ ctx, params }) => {
  const user = await authed(ctx);
  const receipt = getReceipt(ctx, params.receiptId, user.id);
  const bytes = await renderReceiptPdf(receipt.snapshot, receipt.contentHash);
  return new Response(Buffer.from(bytes), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${receipt.receiptNumber}.pdf"`,
      "cache-control": "private, no-store",
    },
  });
});
