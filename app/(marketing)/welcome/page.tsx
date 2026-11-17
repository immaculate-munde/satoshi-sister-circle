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
import { useApp } from "@/components/providers";
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
  const { t, mode } = useApp();
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
          {/* Hero — Jadoo split: copy left, art right */}
          <section className="brand-shell grid items-center gap-10 pb-16 pt-2 lg:grid-cols-2 lg:gap-8 lg:pb-24 lg:pt-4">
            <div className="animate-fade-up order-2 lg:order-1">
              <p className="brand-kicker">{t("landing.hero.kicker")}</p>
              <h1 className="mt-3 max-w-xl text-[2.55rem] leading-[1.08] font-extrabold tracking-tight text-forest sm:text-[3.5rem] lg:text-[3.9rem]">
                {t("landing.hero.title")}
              </h1>
              <p className="mt-5 max-w-lg text-[16px] leading-relaxed text-muted sm:text-[18px]">{t("landing.hero.body")}</p>
              <div className="mt-8 flex flex-col gap-3 sm:max-w-md sm:flex-row sm:items-center">
                <button type="button" className="brand-btn brand-btn-primary sm:flex-1" onClick={() => start("home")} disabled={busy}>
                  {busy && after === "home" ? t("common.loading") : t("welcome.getStarted")}
                </button>
                <button type="button" className="brand-btn brand-btn-outline sm:flex-1" onClick={() => start("invite")} disabled={busy}>
                  {t("welcome.haveInvite")}
                </button>
              </div>
            </div>
            <div className="relative order-1 flex min-h-[340px] items-center justify-center animate-fade-up lg:order-2 lg:min-h-[500px]" style={{ animationDelay: "80ms" }}>
              <LandingHeroArt className="brand-hero-art relative z-[1] w-full max-w-[22rem] sm:max-w-[26rem] lg:max-w-[30rem]" />
              {/* Floating status chips — same pattern as the reference mock */}
              <div className="absolute top-[8%] left-0 z-[2] max-w-[11.5rem] rounded-2xl bg-white px-3 py-2.5 text-[12px] font-semibold text-forest shadow-[var(--shadow-card)] sm:left-[-0.5rem] sm:max-w-[13rem] sm:text-[13px]">
                <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-sage text-[11px] text-money" aria-hidden>
                  ✓
                </span>
                {t("landing.chip.paid")}
              </div>
              <div className="absolute top-[18%] right-0 z-[2] max-w-[11.5rem] rounded-2xl bg-white px-3 py-2.5 text-[12px] font-semibold text-forest shadow-[var(--shadow-card)] sm:right-[-0.5rem] sm:max-w-[13rem] sm:text-[13px]">
                <span className="mr-1.5 inline-block text-btc" aria-hidden>
                  ⚡
                </span>
                {t("landing.chip.payout")}
              </div>
              <div className="absolute bottom-[10%] left-[6%] z-[2] max-w-[12rem] rounded-2xl bg-white px-3 py-2.5 text-[12px] font-semibold text-forest shadow-[var(--shadow-card)] sm:bottom-[14%] sm:text-[13px]">
                <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-money text-[11px] text-white" aria-hidden>
                  3
                </span>
                {t("landing.chip.round")}
              </div>
            </div>
          </section>

          {/* Services — 4 columns */}
          <section id="features" className="brand-shell scroll-mt-24 py-16 sm:py-20">
            <div className="mx-auto max-w-2xl text-center">
              <p className="brand-kicker">{t("landing.features.kicker")}</p>
              <h2 className="mt-2 text-[1.85rem] font-extrabold tracking-tight text-forest sm:text-[2.4rem]">{t("landing.features.title")}</h2>
            </div>
            <ul className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {SERVICES.filter((s) => !(mode.provider === "flash" && s.title === "landing.feature.abroad.title")).map((s) => (
                <li key={s.title} className="group rounded-[28px] bg-white p-6 text-center transition-shadow hover:shadow-[var(--shadow-card)]">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center">{s.icon}</div>
                  <h3 className="text-[17px] font-bold text-forest">{t(s.title)}</h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-muted">{t(s.body)}</p>
                </li>
              ))}
            </ul>
          </section>

          {/* How it works — steps + floating preview */}
          <section id="how" className="brand-shell scroll-mt-24 grid items-center gap-12 py-8 lg:grid-cols-2 lg:gap-16 lg:py-16">
            <div>
              <p className="brand-kicker">{t("landing.how.kicker")}</p>
              <h2 className="mt-2 max-w-md text-[1.85rem] font-extrabold tracking-tight text-forest sm:text-[2.35rem]">{t("landing.how.title")}</h2>
              <ol className="mt-8 space-y-6">
                {STEPS.map((step, i) => (
                  <li key={step.title} className="flex gap-4">
                    <span
                      className={`mt-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold text-white ${
                        step.tone === "btc" ? "bg-btc" : step.tone === "money" ? "bg-money" : "bg-forest"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <div>
                      <h3 className="text-[17px] font-bold text-forest">{t(step.title)}</h3>
                      <p className="mt-1 text-[14px] leading-relaxed text-muted">{t(step.body)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

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
