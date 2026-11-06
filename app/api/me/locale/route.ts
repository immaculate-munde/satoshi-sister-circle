import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { api, parseBody } from "@/lib/api/http";
import { currentUser } from "@/lib/auth/session";
import { run } from "@/lib/db";

export const POST = api(
  async ({ ctx, req }) => {
    const { locale } = await parseBody(req, z.object({ locale: z.enum(["en", "sw"]) }));
    const user = await currentUser(ctx.db);
    if (user) run(ctx.db, "UPDATE users SET locale = :l WHERE id = :id", { l: locale, id: user.id });
    (await cookies()).set("locale", locale, { path: "/", maxAge: 365 * 86400, sameSite: "lax" });
    return NextResponse.json({ locale });
  },
  { mutation: true },
);
