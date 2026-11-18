"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/components/providers";
import { supabase, supabaseEnabled } from "@/lib/client/supabase";

/** Password-reset link target: exchange the code, then let the user choose a new password. */
export default function ResetPage() {
  const t = useT();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !supabaseEnabled) return;
    started.current = true;
    (async () => {
      try {
        const q = new URLSearchParams(window.location.search);
        const failure = q.get("error_description") ?? q.get("error");
        if (failure) throw new Error(failure);
        const code = q.get("code");
        if (code) {
          const { error: err } = await supabase().auth.exchangeCodeForSession(code);
          if (err) throw err;
        }
        const { data } = await supabase().auth.getSession();
        if (!data.session) throw new Error("This reset link has expired. Request a new one from the sign-in page.");
        setReady(true);
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await supabase().auth.updateUser({ password });
      if (err) throw err;
      await supabase().auth.signOut({ scope: "local" });
      router.replace("/signin?reset=1");
    } catch (e2) {
      setError((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-forest px-6 text-white">
      <div className="w-full max-w-sm">
        <h1 className="text-[1.9rem] font-extrabold">{t("auth.reset.title")}</h1>
        {error ? (
          <p role="alert" className="mt-5 rounded-xl bg-danger-wash px-4 py-3 text-[14px] font-medium text-danger">
            {error}
          </p>
        ) : null}
        {ready ? (
          <form onSubmit={save} className="mt-6 space-y-5">
            <label className="block">
              <span className="mb-2 block text-[14px] font-semibold">{t("auth.password")}</span>
              <input
                type="password"
                className="w-full min-h-[3.4rem] rounded-2xl border border-white/10 bg-white/[0.08] px-4 text-white outline-none focus:border-btc"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
                autoComplete="new-password"
                placeholder={t("auth.passwordHint")}
              />
            </label>
            <button type="submit" disabled={busy} className="brand-btn w-full bg-btc text-forest disabled:opacity-60">
              {busy ? t("auth.working") : t("auth.reset.save")}
            </button>
          </form>
        ) : !error ? (
          <p className="mt-5 text-white/80">{t("auth.callback.working")}</p>
        ) : (
          <a href="/signin" className="brand-btn mt-6 w-full bg-btc text-forest">
            {t("auth.signInLink")}
          </a>
        )}
      </div>
    </div>
  );
}
