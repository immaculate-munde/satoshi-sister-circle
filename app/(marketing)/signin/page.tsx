"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Logo } from "@/components/art";
import { useT } from "@/components/providers";
import { apiFetch } from "@/lib/client/api";
import { establishAppSession, safeNext, supabase, supabaseEnabled } from "@/lib/client/supabase";

const field =
  "w-full min-h-[3.4rem] rounded-2xl border border-line bg-white px-4 text-[15px] text-ink placeholder:text-muted/70 outline-none transition focus:border-money";

function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.1z" />
      <path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

function SignIn() {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [mode, setMode] = useState<"signin" | "signup">(params.get("mode") === "signup" ? "signup" : "signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState<"form" | "google" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(params.get("reset") === "1" ? t("auth.reset.done") : null);

  // Already signed in? Go straight on.
  useEffect(() => {
    apiFetch<{ user: { id: string } | null }>("/api/me")
      .then((me) => {
        if (me.user) router.replace(next);
      })
      .catch(() => {});
  }, [router, next]);

  if (!supabaseEnabled) {
    return (
      <Shell t={t}>
        <p className="rounded-2xl bg-sage p-4 text-[15px] text-forest">{t("auth.notConfigured")}</p>
      </Shell>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy("form");
    try {
      if (mode === "signup") {
        const { data, error: err } = await supabase().auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name.trim() },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (err) throw err;
        if (!data.session) {
          // E-mail confirmation is on: they must click the link first.
          sessionStorage.setItem("chama:next", next);
          setInfo(t("auth.checkEmail"));
          return;
        }
        await establishAppSession(name.trim() || undefined);
      } else {
        const { error: err } = await supabase().auth.signInWithPassword({ email, password });
        if (err) throw err;
        await establishAppSession();
      }
      router.push(next);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function google() {
    setError(null);
    setInfo(null);
    setBusy("google");
    try {
      sessionStorage.setItem("chama:next", next);
      const { error: err } = await supabase().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (err) throw err;
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    }
  }

  async function forgot() {
    setError(null);
    setInfo(null);
    if (!email.trim()) {
      setError(t("auth.enterEmailFirst"));
      return;
    }
    const { error: err } = await supabase().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/reset`,
    });
    if (err) setError(err.message);
    else setInfo(t("auth.resetSent"));
  }

  const signup = mode === "signup";

  return (
    <Shell t={t}>
      <h1 className="text-[2.4rem] leading-tight font-extrabold text-forest">{signup ? t("auth.signup.title") : t("auth.title")}</h1>
      <p className="mt-3 text-[15px] text-muted">{signup ? t("auth.signup.subtitle") : t("auth.subtitle")}</p>

      <form onSubmit={submit} className="mt-8 space-y-5" noValidate={false}>
        {signup ? (
          <label className="block">
            <span className="mb-2 block text-[14px] font-semibold text-forest">{t("auth.name")}</span>
            <input className={field} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required autoComplete="name" />
          </label>
        ) : null}
        <label className="block">
          <span className="mb-2 block text-[14px] font-semibold text-forest">{t("auth.email")}</span>
          <input className={field} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </label>
        <label className="block">
          <span className="mb-2 block text-[14px] font-semibold text-forest">{t("auth.password")}</span>
          <span className="relative block">
            <input
              className={`${field} pr-12`}
              type={show ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete={signup ? "new-password" : "current-password"}
              placeholder={signup ? t("auth.passwordHint") : undefined}
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              aria-label={show ? t("auth.hidePassword") : t("auth.showPassword")}
              className="absolute top-1/2 right-3 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:text-forest"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
                <circle cx="12" cy="12" r="3" />
                {show ? <path d="M3 3l18 18" /> : null}
              </svg>
            </button>
          </span>
        </label>

        {!signup ? (
          <div className="text-right">
            <button type="button" onClick={forgot} className="text-[14px] font-semibold text-money hover:underline">
              {t("auth.forgot")}
            </button>
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="rounded-xl bg-danger-wash px-4 py-3 text-[14px] font-medium text-danger">
            {error}
          </p>
        ) : null}
        {info ? (
          <p role="status" className="rounded-xl bg-sage px-4 py-3 text-[14px] font-medium text-forest">
            {info}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy !== null}
          className="brand-btn brand-btn-primary w-full !text-[1rem] disabled:opacity-60"
        >
          {busy === "form" ? t("auth.working") : signup ? t("auth.submitSignup") : t("auth.submit")}
        </button>
      </form>

      <div className="my-6 flex items-center gap-4 text-[13px] text-muted">
        <span className="h-px flex-1 bg-line" />
        {t("auth.or")}
        <span className="h-px flex-1 bg-line" />
      </div>

      <button
        type="button"
        onClick={google}
        disabled={busy !== null}
        className="brand-btn brand-btn-outline w-full gap-3 disabled:opacity-60"
      >
        <GoogleMark />
        {busy === "google" ? t("auth.working") : t("auth.google")}
      </button>

      <p className="mt-7 text-center text-[14px] text-muted">
        {signup ? t("auth.haveAccount") : t("auth.noAccount")}{" "}
        <button
          type="button"
          onClick={() => {
            setMode(signup ? "signin" : "signup");
            setError(null);
            setInfo(null);
          }}
          className="font-bold text-money underline-offset-4 hover:underline"
        >
          {signup ? t("auth.signInLink") : t("auth.signUpLink")}
        </button>
      </p>
    </Shell>
  );
}

/** Split layout: blush brand panel, white form. */
function Shell({ children, t }: { children: React.ReactNode; t: ReturnType<typeof useT> }) {
  return (
    <div className="min-h-dvh bg-paper lg:grid lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-white lg:block">
        <div className="kente-rail absolute inset-y-0 left-0 w-3" aria-hidden />
        <div className="brand-blob -top-16 right-[-4rem] h-72 w-72" aria-hidden />
        <div className="relative flex h-full min-h-dvh flex-col justify-between px-14 py-12 pl-16 xl:px-20 xl:pl-20">
          <div className="flex items-center gap-3">
            <Logo size={52} />
            <span className="text-[26px] leading-none font-extrabold tracking-tight text-forest">
              {t("app.name")}
              <span className="mt-1 block text-[12px] font-semibold tracking-wide text-money">{t("app.tagline")}</span>
            </span>
          </div>
          <div>
            <h2 className="max-w-lg text-[2.8rem] leading-[1.05] font-extrabold text-forest">{t("auth.side.title")}</h2>
            <p className="mt-5 max-w-md text-[17px] leading-relaxed text-muted">{t("auth.side.body")}</p>
          </div>
          <div className="relative mt-8 h-[min(42vh,22rem)] overflow-hidden rounded-[32px] shadow-[var(--shadow-card)]">
            <Image
              src="/images/landing/three-friends.jpg"
              alt="Three young women laughing together, wrapped in colourful fabric"
              fill
              priority
              sizes="46vw"
              className="object-cover object-[center_30%]"
            />
          </div>
        </div>
      </aside>

      <main className="relative flex min-h-dvh flex-col bg-white px-6 py-6 sm:px-12 lg:px-16">
        <header className="flex items-center justify-between">
          <Link href="/welcome" className="inline-flex items-center gap-2 text-[14px] font-semibold text-forest hover:text-money">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 11l9-8 9 8" />
              <path d="M5 10v10h14V10" />
            </svg>
            {t("auth.home")}
          </Link>
          <span className="flex items-center gap-2 lg:hidden">
            <Logo size={36} />
          </span>
        </header>
        <div className="mx-auto flex w-full max-w-[26rem] flex-1 flex-col justify-center py-10">{children}</div>
      </main>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignIn />
    </Suspense>
  );
}
