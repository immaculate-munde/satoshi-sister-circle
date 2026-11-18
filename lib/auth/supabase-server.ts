import { DomainError } from "../domain/context";

export interface SupabaseIdentity {
  authUserId: string;
  email: string | null;
  name: string;
}

/**
 * Verify a Supabase access token by asking Supabase Auth who it belongs to. Nothing is trusted from the
 * client except the token itself; the response comes from Supabase over TLS.
 */
export async function verifySupabaseToken(accessToken: string): Promise<SupabaseIdentity> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new DomainError("AUTH_NOT_CONFIGURED", "Sign-in is not configured on this server", 503);

  let res: Response;
  try {
    res = await fetch(`${url.replace(/\/$/, "")}/auth/v1/user`, {
      headers: { apikey: anon, authorization: `Bearer ${accessToken}` },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new DomainError("AUTH_UNAVAILABLE", "Could not reach the sign-in service. Try again.", 503, true);
  }
  if (!res.ok) throw new DomainError("BAD_TOKEN", "Your sign-in expired. Please try again.", 401);

  const u = (await res.json()) as {
    id?: string;
    email?: string | null;
    email_confirmed_at?: string | null;
    user_metadata?: { full_name?: string; name?: string };
  };
  if (!u.id) throw new DomainError("BAD_TOKEN", "Your sign-in expired. Please try again.", 401);
  if (u.email && !u.email_confirmed_at) throw new DomainError("EMAIL_UNCONFIRMED", "Confirm your email first, then sign in.", 401);

  const email = u.email ?? null;
  const raw = (u.user_metadata?.full_name || u.user_metadata?.name || (email ? email.split("@")[0] : "") || "Member").trim();
  return { authUserId: u.id, email, name: raw.slice(0, 40) || "Member" };
}
