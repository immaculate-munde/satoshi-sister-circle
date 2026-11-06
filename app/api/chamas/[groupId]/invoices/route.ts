import { z } from "zod";
import { api, authed, idempotent, parseBody, rateLimit } from "@/lib/api/http";
import { requestInvoice } from "@/lib/domain/invoices";

const schema = z.object({ forceNew: z.boolean().optional() });

/** Create or reuse the caller's invoice for the current round. Amount and asset come from the server. */
export const POST = api<{ groupId: string }>(
  async (a) => {
    const user = await authed(a.ctx);
    rateLimit(a.req, "invoice-create", 20, 60_000, user.id);
    const { forceNew } = await parseBody(a.req, schema);
    return idempotent(a, user.id, `invoice:${a.params.groupId}`, async () => ({
      status: 200,
      body: await requestInvoice(a.ctx, { userId: user.id, groupId: a.params.groupId, kind: "CONTRIBUTION", forceNew }),
    }));
  },
  { mutation: true },
);
