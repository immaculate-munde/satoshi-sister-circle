import { NextResponse } from "next/server";
import { api } from "@/lib/api/http";
import { destroySession } from "@/lib/auth/session";

export const POST = api(
  async ({ ctx }) => {
    await destroySession(ctx.db);
    return NextResponse.json({ ok: true });
  },
  { mutation: true },
);
