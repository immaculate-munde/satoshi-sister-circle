"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { LandingHeroArt, Logo } from "@/components/art";
import {
  FeatureIconAbroad,
  FeatureIconLedger,
  FeatureIconLightning,
  FeatureIconPayout,
} from "@/components/landing-visuals";
import { useT } from "@/components/providers";
import { SignInDialog } from "@/features/auth/signin-dialog";
import { apiFetch } from "@/lib/client/api";
import type { MessageKey } from "@/i18n/en";
import type { ReactNode } from "react";

const SERVICES: { title: MessageKey; body: MessageKey; icon: ReactNode }[] = [
  { title: "landing.feature.ledger.title", body: "landing.feature.ledger.body", icon: <FeatureIconLedger /> },
  { title: "landing.feature.payout.title", body: "landing.feature.payout.body", icon: <FeatureIconPayout /> },
  { title: "landing.feature.lightning.title", body: "landing.feature.lightning.body", icon: <FeatureIconLightning /> },
  { title: "landing.feature.abroad.title", body: "landing.feature.abroad.body", icon: <FeatureIconAbroad /> },
];

const STEPS: { title: MessageKey; body: MessageKey; tone: "btc" | "money" | "forest" }[] = [
  { title: "landing.how.1.title", body: "landing.how.1.body", tone: "btc" },
  { title: "landing.how.2.title", body: "landing.how.2.body", tone: "money" },
  { title: "landing.how.3.title", body: "landing.how.3.body", tone: "forest" },
];

function Landing() {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/home";
  const [signInOpen, setSignInOpen] = useState(params.get("signin") === "1");
  const [after, setAfter] = useState<"home" | "invite">("home");
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  async function start(target: "home" | "invite") {
    setBusy(true);
    try {
      const me = await apiFetch<{ user: { id: string } | null }>("/api/me");
      if (me.user) {
        if (target === "home") router.push(safeNext);
        else router.push("/join");
        return;
      }
      setAfter(target);
      setSignInOpen(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="brand-page min-h-dvh pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <header className="brand-shell flex items-center justify-between gap-4 py-5 sm:py-7">
          <a href="#top" className="flex items-center gap-2.5" aria-label={`${t("app.name")} ${t("app.on")}`}>
            <Logo size={44} />
            <span className="text-[20px] font-extrabold tracking-tight text-forest">
              {t("app.name")}
              <span className="ml-1 font-semibold text-btc">{t("app.on")}</span>
            </span>
          </a>

          <nav className="hidden items-center gap-8 text-[15px] font-semibold text-ink/80 lg:flex" aria-label={t("nav.primary")}>
            <a href="#features" className="hover:text-money">
              {t("landing.nav.features")}
            </a>
            <a href="#how" className="hover:text-money">
              {t("landing.nav.how")}
            </a>
            <a href="#stories" className="hover:text-money">
              {t("landing.nav.stories")}
            </a>
            <button type="button" className="brand-btn brand-btn-outline !min-h-11 !px-5 !text-[14px]" onClick={() => start("home")} disabled={busy}>
              {t("landing.nav.cta")}
            </button>
          </nav>

          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-line bg-white text-forest lg:hidden"
            aria-expanded={menuOpen}
            aria-label="Menu"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span aria-hidden className="text-xl leading-none">
              {menuOpen ? "×" : "☰"}
            </span>
          </button>
        </header>

        {menuOpen ? (
          <div className="brand-shell mb-4 flex flex-col gap-2 rounded-[28px] bg-white p-4 shadow-[var(--shadow-card)] lg:hidden">
            <a href="#features" className="min-h-11 rounded-xl px-3 py-2 font-semibold" onClick={() => setMenuOpen(false)}>
              {t("landing.nav.features")}
            </a>
            <a href="#how" className="min-h-11 rounded-xl px-3 py-2 font-semibold" onClick={() => setMenuOpen(false)}>
              {t("landing.nav.how")}
            </a>
            <a href="#stories" className="min-h-11 rounded-xl px-3 py-2 font-semibold" onClick={() => setMenuOpen(false)}>
              {t("landing.nav.stories")}
            </a>
            <button type="button" className="brand-btn brand-btn-primary w-full" onClick={() => start("home")} disabled={busy}>
              {t("landing.nav.cta")}
            </button>
          </div>
        ) : null}

        <main id="top">
          {/* Hero: wide art banner with a floating cream card (furniture-landing pattern) */}
          <section className="brand-shell pb-14 lg:pb-20">
            <div className="relative overflow-hidden rounded-[28px] bg-sage">
              <div className="relative flex min-h-[340px] items-center justify-center px-4 pt-8 pb-40 sm:min-h-[420px] lg:min-h-[500px] lg:justify-start lg:px-16 lg:pb-8">
                <LandingHeroArt className="brand-hero-art relative z-[1] w-full max-w-[20rem] sm:max-w-[24rem] lg:max-w-[28rem]" />
                <div className="absolute top-[8%] left-3 z-[2] max-w-[11.5rem] rounded-2xl bg-white px-3 py-2.5 text-[12px] font-semibold text-forest shadow-[var(--shadow-card)] sm:left-8 sm:text-[13px]">
                  <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-sage text-[11px] text-money" aria-hidden>
                    ✓
                  </span>
                  {t("landing.chip.paid")}
                </div>
                <div className="absolute top-[26%] left-[42%] z-[2] hidden max-w-[13rem] rounded-2xl bg-white px-3 py-2.5 text-[13px] font-semibold text-forest shadow-[var(--shadow-card)] lg:block">
                  <span className="mr-1.5 inline-block text-btc" aria-hidden>
                    ⚡
                  </span>
                  {t("landing.chip.payout")}
                </div>
              </div>
              <div className="animate-fade-up absolute right-4 bottom-4 left-4 z-[3] rounded-[22px] bg-cream p-6 shadow-[var(--shadow-soft)] sm:left-auto sm:max-w-md sm:p-8 lg:top-1/2 lg:right-12 lg:bottom-auto lg:-translate-y-1/2">
                <p className="brand-kicker">{t("landing.hero.kicker")}</p>
                <h1 className="mt-2 text-[1.8rem] leading-[1.12] font-extrabold tracking-tight text-forest sm:text-[2.2rem]">
                  {t("landing.hero.title")}
                </h1>
                <p className="mt-3 text-[14px] leading-relaxed text-ink/80 sm:text-[15px]">{t("landing.hero.body")}</p>
                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <button type="button" className="brand-btn brand-btn-primary sm:flex-1" onClick={() => start("home")} disabled={busy}>
                    {busy && after === "home" ? t("common.loading") : t("welcome.getStarted")}
                  </button>
                  <button type="button" className="brand-btn brand-btn-outline sm:flex-1" onClick={() => start("invite")} disabled={busy}>
                    {t("welcome.haveInvite")}
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Browse the range: three tall cards with labels underneath (our 3 steps) */}
          <section id="how" className="brand-shell scroll-mt-24 py-12 text-center sm:py-16">
            <h2 className="text-[1.6rem] font-extrabold tracking-tight text-forest sm:text-[2rem]">{t("landing.how.title")}</h2>
            <p className="brand-kicker mt-2">{t("landing.how.kicker")}</p>
            <ol className="mx-auto mt-10 grid max-w-4xl gap-6 sm:grid-cols-3">
              {STEPS.map((step, i) => (
                <li key={step.title}>
                  <div
                    className={`flex h-72 flex-col items-center justify-center rounded-2xl px-5 text-center sm:h-80 ${
                      step.tone === "btc" ? "bg-cream" : step.tone === "money" ? "bg-sage" : "bg-forest"
                    }`}
                  >
                    <span
                      className={`text-[5rem] leading-none font-extrabold ${step.tone === "forest" ? "text-btc" : step.tone === "btc" ? "text-btc" : "text-money"}`}
                    >
                      {i + 1}
                    </span>
                    <p className={`mt-4 text-[13.5px] leading-relaxed ${step.tone === "forest" ? "text-cream/90" : "text-ink/75"}`}>{t(step.body)}</p>
                  </div>
                  <h3 className="mt-4 text-[16px] font-bold text-forest">{t(step.title)}</h3>
                </li>
              ))}
            </ol>
          </section>

          {/* Features: product-style grid with hover overlay */}
          <section id="features" className="brand-shell scroll-mt-24 py-12 sm:py-16">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-[1.6rem] font-extrabold tracking-tight text-forest sm:text-[2rem]">{t("landing.features.title")}</h2>
              <p className="brand-kicker mt-2">{t("landing.features.kicker")}</p>
            </div>
            <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {SERVICES.map((s) => (
                <li key={s.title} className="group overflow-hidden rounded-2xl bg-white shadow-[var(--shadow-card)]">
                  <div className="relative flex h-44 items-center justify-center bg-paper">
                    <div className="flex h-16 w-16 items-center justify-center">{s.icon}</div>
                    <div className="absolute inset-0 flex items-center justify-center bg-forest/75 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                      <button
                        type="button"
                        className="rounded-md bg-white px-4 py-2 text-[13px] font-bold text-forest"
                        onClick={() => start("home")}
                        disabled={busy}
                      >
                        {t("welcome.getStarted")}
                      </button>
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="text-[15px] font-bold text-forest">{t(s.title)}</h3>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{t(s.body)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* Live preview card */}
          <section className="brand-shell py-10 lg:py-14">
            <div className="relative mx-auto w-full max-w-md">
              <div className="brand-soft-card relative z-[1] p-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sage text-lg font-extrabold text-money">U</span>
                  <div>
                    <p className="font-bold text-forest">Umoja Women Chama</p>
                    <p className="text-[13px] text-muted">{t("landing.preview.round")}</p>
                  </div>
                </div>
                <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-sage">
                  <div className="h-full w-2/3 rounded-full bg-money" />
                </div>
                <p className="mt-2 text-[13px] font-semibold text-muted">{t("landing.preview.paid", { paid: 2, total: 3 })}</p>
                <div className="mt-5 rounded-2xl bg-forest p-4 text-white">
                  <p className="text-[12px] text-cream/80">{t("home.totalSaved")}</p>
                  <p className="mt-1 text-2xl font-extrabold">KES 10,000</p>
                </div>
              </div>
              <div className="brand-soft-card absolute -right-2 -bottom-6 z-[2] w-[70%] p-4 sm:-right-6">
                <p className="text-[13px] font-bold text-forest">{t("landing.preview.next")}</p>
                <div className="mt-2 flex -space-x-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-money text-[11px] font-bold text-white ring-2 ring-white">A</span>
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-btc text-[11px] font-bold text-forest ring-2 ring-white">W</span>
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-forest text-[11px] font-bold text-white ring-2 ring-white">F</span>
                </div>
              </div>
            </div>
          </section>

          {/* Honest custody note (no testimonials until real ones exist) */}
          <section id="stories" className="brand-shell scroll-mt-24 py-20">
            <div className="mx-auto max-w-3xl text-center">
              <p className="brand-kicker">{t("landing.nav.stories")}</p>
              <blockquote className="mt-6 text-[1.15rem] leading-snug font-semibold text-forest sm:text-[1.4rem]">{t("landing.quote")}</blockquote>
              <p className="mt-5 text-[15px] font-bold text-btc">{t("landing.quote.by")}</p>
            </div>
          </section>

          {/* Soft CTA banner */}
          <section className="brand-shell pb-16 sm:pb-20">
            <div className="relative overflow-hidden rounded-[32px] bg-sage px-6 py-10 sm:px-12 sm:py-14">
              <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-btc/20" aria-hidden />
              <div className="absolute -bottom-12 -left-8 h-36 w-36 rounded-full bg-money/15" aria-hidden />
              <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-xl">
                  <h2 className="text-[1.75rem] font-extrabold tracking-tight text-forest sm:text-[2.25rem]">{t("landing.banner.title")}</h2>
                  <p className="mt-3 text-[15px] leading-relaxed text-muted sm:text-[16px]">{t("landing.banner.body")}</p>
                </div>
                <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                  <button type="button" className="brand-btn brand-btn-primary" onClick={() => start("home")} disabled={busy}>
                    {t("welcome.getStarted")}
                  </button>
                  <button type="button" className="brand-btn brand-btn-outline" onClick={() => start("invite")} disabled={busy}>
                    {t("welcome.haveInvite")}
                  </button>
                </div>
              </div>
            </div>
          </section>
        </main>

        <footer className="border-t border-line bg-paper">
          <div className="brand-shell grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-4">
            <div className="lg:col-span-2">
              <p className="text-[18px] font-extrabold text-forest">
                {t("app.name")} <span className="text-btc">{t("app.on")}</span>
              </p>
              <p className="mt-3 max-w-md text-[13px] leading-relaxed text-muted">{t("welcome.custody")}</p>
            </div>
            <div>
              <p className="text-[13px] font-bold tracking-wide text-forest uppercase">{t("landing.nav.features")}</p>
              <ul className="mt-3 space-y-2 text-[14px] text-muted">
                <li>
                  <a href="#features" className="hover:text-money">
                    {t("landing.feature.ledger.title")}
                  </a>
                </li>
                <li>
                  <a href="#how" className="hover:text-money">
                    {t("landing.nav.how")}
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <p className="text-[13px] font-bold tracking-wide text-forest uppercase">{t("landing.footer.rights")}</p>
              <p className="mt-3 text-[13px] text-muted">{t("app.tagline")}</p>
            </div>
          </div>
        </footer>
      </div>

      <SignInDialog
        open={signInOpen}
        onClose={() => setSignInOpen(false)}
        onSignedIn={() => {
          setSignInOpen(false);
          if (after === "invite") router.push("/join");
          else router.push(safeNext);
        }}
      />
    </>
  );
}

export default function WelcomePage() {
  return (
    <Suspense>
      <Landing />
    </Suspense>
  );
}
