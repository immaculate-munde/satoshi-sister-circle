import { z } from "zod";
import { api, authed, idempotent, parseBody, rateLimit } from "@/lib/api/http";
import { createDiasporaInvoice } from "@/lib/domain/diaspora";

const schema = z.object({
  memberId: z.string().uuid(),
  payerName: z.string().trim().min(1).max(40),
  payerCity: z.string().trim().max(40).default(""),
});

/** Existing member obligation + separate payer attribution. Never adds an extra contribution. */
export const POST = api<{ groupId: string }>(
  async (a) => {
    const user = await authed(a.ctx);
    rateLimit(a.req, "invoice-create", 20, 60_000, user.id);
    const input = await parseBody(a.req, schema);
    return idempotent(a, user.id, `diaspora:${a.params.groupId}`, async () => ({
      status: 200,
      body: await createDiasporaInvoice(a.ctx, { userId: user.id, groupId: a.params.groupId, ...input }),
    }));
  },
  { mutation: true },
);
