"use client";

import { useRouter } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { useT } from "@/components/providers";
import { establishAppSession, safeNext, supabase, supabaseEnabled } from "@/lib/client/supabase";

/** Landing spot for Google sign-in and e-mail confirmation links. */
function Callback() {
  const t = useT();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // React strict mode runs effects twice; a code can be exchanged only once.
    started.current = true;
    (async () => {
      try {
        if (!supabaseEnabled) throw new Error(t("auth.notConfigured"));
        const q = new URLSearchParams(window.location.search);
        const failure = q.get("error_description") ?? q.get("error");
        if (failure) throw new Error(failure);
        const code = q.get("code");
        if (code) {
          const { error: err } = await supabase().auth.exchangeCodeForSession(code);
          if (err) throw err;
        }
        await establishAppSession();
        const next = safeNext(sessionStorage.getItem("chama:next"));
        sessionStorage.removeItem("chama:next");
        router.replace(next);
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, [router, t]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-paper px-6 text-center text-forest">
      {error ? (
        <div className="max-w-sm space-y-4">
          <p role="alert" className="rounded-xl bg-danger-wash px-4 py-3 text-[14px] font-medium text-danger">
            {error}
          </p>
          <a href="/signin" className="brand-btn brand-btn-primary">
            {t("auth.signInLink")}
          </a>
        </div>
      ) : (
        <p className="text-[16px] font-semibold">{t("auth.callback.working")}</p>
      )}
    </div>
  );
}

export default function CallbackPage() {
  return (
    <Suspense>
      <Callback />
    </Suspense>
  );
}
