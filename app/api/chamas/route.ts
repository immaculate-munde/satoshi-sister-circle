import { NextResponse } from "next/server";
import { z } from "zod";
import { api, authed, idempotent, parseBody, rateLimit } from "@/lib/api/http";
import { createChama, listChamas } from "@/lib/domain/chamas";

export const GET = api(async ({ ctx }) => {
  const user = await authed(ctx);
  return NextResponse.json(listChamas(ctx, user.id));
});

const createSchema = z.object({
  name: z.string().trim().min(2).max(60),
  contributionKes: z.string().regex(/^\d{1,7}$/),
  frequency: z.enum(["WEEKLY", "MONTHLY", "CUSTOM"]),
  customIntervalDays: z.number().int().min(1).max(365).optional(),
  settlementAsset: z.enum(["BTC_SAT", "USD_CENT"]),
  firstDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  members: z
    .array(
      z.object({
        displayName: z.string().trim().min(1).max(40),
        isMe: z.boolean(),
        payoutPreference: z.enum(["BTC", "USD"]),
        destinationRef: z.string().trim().max(60).optional(),
      }),
    )
    .min(3)
    .max(20),
});

export const POST = api(
  async (a) => {
    const user = await authed(a.ctx);
    rateLimit(a.req, "create-chama", 10, 60_000, user.id);
    const input = await parseBody(a.req, createSchema);
    return idempotent(a, user.id, "create-chama", async () => {
      const { group, invite } = await createChama(a.ctx, user.id, input);
      return { status: 201, body: { groupId: group.id, invite } };
    });
  },
  { mutation: true },
);
