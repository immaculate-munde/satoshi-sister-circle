"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** True when the Supabase project URL and anon key are configured for this build. */
export const supabaseEnabled = Boolean(URL && KEY);

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!URL || !KEY) throw new Error("Supabase is not configured");
  client ??= createClient(URL, KEY, {
    // We run the code exchange ourselves on /auth/callback and keep our own server session cookie.
    auth: { flowType: "pkce", persistSession: true, detectSessionInUrl: false, autoRefreshToken: false },
  });
  return client;
}

/** Only same-site relative paths are allowed as a post-login destination. */
export function safeNext(next: string | null | undefined, fallback = "/home") {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}

/** Hand the Supabase session to our server, which sets the app session cookie. */
export async function establishAppSession(displayName?: string) {
  const { data } = await supabase().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("No sign-in session found. Please try again.");
  // Plain fetch (not apiFetch): a 401 here must show its message, not bounce back to the sign-in page.
  const res = await fetch("/api/auth/supabase", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ accessToken: token, displayName }),
    credentials: "same-origin",
  });
  if (!res.ok) {
    const j = await res.json().catch(() => null);
    throw new Error(j?.error?.message ?? `Sign-in failed (${res.status})`);
  }
  // The browser copy of the Supabase session is no longer needed.
  await supabase().auth.signOut({ scope: "local" });
}
