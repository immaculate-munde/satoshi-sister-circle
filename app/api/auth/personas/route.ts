import { NextResponse } from "next/server";
import { api } from "@/lib/api/http";
import { config } from "@/lib/config";
import { many } from "@/lib/db";

/** Demo-only: the seeded test personas you can switch between to play each member. */
export const GET = api(async ({ ctx }) => {
  if (!config().demo) return NextResponse.json({ personas: [] });
  const personas = await many<{ id: string; display_name: string }>(
    ctx.db,
    "SELECT id, display_name FROM users WHERE is_demo = 1 ORDER BY created_at",
  );
  return NextResponse.json({ personas: personas.map((p) => ({ id: p.id, displayName: p.display_name })) });
});
