"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { LandingHeroArt, Logo } from "@/components/art";
import { useT } from "@/components/providers";
import { SignInDialog } from "@/features/auth/signin-dialog";
import { apiFetch } from "@/lib/client/api";
import type { MessageKey } from "@/i18n/en";

type Tone = "fog" | "lime" | "ink";

const FEATURES: { title: MessageKey; body: MessageKey; tone: Tone; href: string }[] = [
  { title: "landing.feature.ledger.title", body: "landing.feature.ledger.body", tone: "fog", href: "#how" },
  { title: "landing.feature.payout.title", body: "landing.feature.payout.body", tone: "lime", href: "#how" },
  { title: "landing.feature.lightning.title", body: "landing.feature.lightning.body", tone: "ink", href: "#how" },
  { title: "landing.feature.abroad.title", body: "landing.feature.abroad.body", tone: "fog", href: "#how" },
];

const STEPS: { title: MessageKey; body: MessageKey }[] = [
  { title: "landing.how.1.title", body: "landing.how.1.body" },
  { title: "landing.how.2.title", body: "landing.how.2.body" },
  { title: "landing.how.3.title", body: "landing.how.3.body" },
];

function toneClass(tone: Tone) {
  if (tone === "lime") return "bg-lime text-ink-strong";
  if (tone === "ink") return "bg-ink-strong text-white";
  return "bg-fog text-ink-strong";
}

function SectionHeading({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="mb-10 flex flex-col gap-4 md:mb-12 md:flex-row md:items-end md:gap-8">
      <h2 className="shrink-0">
        <span className="landing-chip text-[1.35rem] sm:text-[1.6rem]">{kicker}</span>
      </h2>
      <p className="max-w-xl text-[16px] leading-relaxed text-ink-strong/80 sm:text-[18px]">{title}</p>
    </div>
  );
}

function FeatureCard({
  title,
  body,
  tone,
  learn,
  href,
}: {
  title: string;
  body: string;
  tone: Tone;
  learn: string;
  href: string;
}) {
  const dark = tone === "ink";
  return (
    <article className={`landing-card flex min-h-[220px] flex-col justify-between gap-6 p-8 sm:p-10 ${toneClass(tone)}`}>
      <div>
        <h3 className="text-[1.35rem] leading-tight font-medium sm:text-[1.6rem]">
          <span className={dark ? "rounded-md bg-white px-1.5 text-ink-strong" : "landing-chip"}>{title}</span>
        </h3>
        <p className={`mt-5 text-[15px] leading-relaxed sm:text-[16px] ${dark ? "text-white/85" : "text-ink-strong/80"}`}>{body}</p>
      </div>
      <a href={href} className={`inline-flex items-center gap-3 text-[15px] font-medium ${dark ? "text-lime" : "text-ink-strong"}`}>
        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${dark ? "bg-lime text-ink-strong" : "bg-ink-strong text-white"}`} aria-hidden>
          →
        </span>
        {learn}
      </a>
    </article>
  );
}

function Landing() {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/home";
  const [signInOpen, setSignInOpen] = useState(params.get("signin") === "1");
  const [after, setAfter] = useState<"home" | "invite">("home");
  const [busy, setBusy] = useState(false);
  const [openStep, setOpenStep] = useState(0);
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
      <div className="landing-page min-h-dvh pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <header className="landing-shell flex items-center justify-between gap-4 py-5 sm:py-7">
          <a href="#top" className="flex items-center gap-2.5" aria-label={`${t("app.name")} ${t("app.on")}`}>
            <Logo size={44} />
            <span className="text-[18px] font-bold tracking-tight sm:text-[20px]">
              {t("app.name")}
              <span className="ml-1 font-semibold text-ink-strong/55">{t("app.on")}</span>
            </span>
          </a>

          <nav className="hidden items-center gap-8 text-[15px] font-medium lg:flex" aria-label={t("nav.primary")}>
            <a href="#features" className="hover:opacity-70">
              {t("landing.nav.features")}
            </a>
            <a href="#how" className="hover:opacity-70">
              {t("landing.nav.how")}
            </a>
            <button type="button" className="landing-btn landing-btn-outline !min-h-11 !px-5 !text-[15px]" onClick={() => start("home")} disabled={busy}>
              {t("landing.nav.cta")}
            </button>
          </nav>

          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-ink-strong lg:hidden"
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
          <div className="landing-shell mb-4 flex flex-col gap-3 rounded-3xl border border-ink-strong bg-white p-4 lg:hidden">
            <a href="#features" className="min-h-11 rounded-xl px-3 py-2 font-medium" onClick={() => setMenuOpen(false)}>
              {t("landing.nav.features")}
            </a>
            <a href="#how" className="min-h-11 rounded-xl px-3 py-2 font-medium" onClick={() => setMenuOpen(false)}>
              {t("landing.nav.how")}
            </a>
            <button type="button" className="landing-btn landing-btn-dark w-full" onClick={() => start("home")} disabled={busy}>
              {t("landing.nav.cta")}
            </button>
          </div>
        ) : null}

        <main id="top">
          {/* Hero */}
          <section className="landing-shell grid items-center gap-10 pb-14 pt-4 lg:grid-cols-2 lg:gap-12 lg:pb-20 lg:pt-6">
            <div className="animate-fade-up order-2 lg:order-1">
              <p className="text-[13px] font-bold tracking-[0.08em] text-ink-strong/55 uppercase">
                {t("app.name")} · {t("app.on")}
              </p>
              <h1 className="mt-4 max-w-xl text-[2.35rem] leading-[1.08] font-medium tracking-tight sm:text-[3.25rem] lg:text-[3.6rem]">
                {t("landing.hero.title")}
              </h1>
              <p className="mt-6 max-w-lg text-[16px] leading-relaxed text-ink-strong/80 sm:text-[18px]">{t("landing.hero.body")}</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <button type="button" className="landing-btn landing-btn-dark" onClick={() => start("home")} disabled={busy}>
                  {busy && after === "home" ? t("common.loading") : t("welcome.getStarted")}
                </button>
                <button type="button" className="landing-btn landing-btn-outline" onClick={() => start("invite")} disabled={busy}>
                  {t("welcome.haveInvite")}
                </button>
              </div>
            </div>
            <div className="order-1 flex justify-center animate-fade-up lg:order-2" style={{ animationDelay: "80ms" }}>
              <LandingHeroArt className="landing-hero-art w-full max-w-[26rem] lg:max-w-none" />
            </div>
          </section>

          {/* Trust strip */}
          <section className="landing-shell border-y border-ink-strong/15 py-8" aria-label={t("landing.features.kicker")}>
            <ul className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-[15px] font-semibold tracking-wide text-ink-strong/45 uppercase sm:justify-between sm:text-[16px]">
              <li>{t("landing.trust.ledger")}</li>
              <li>{t("landing.trust.payout")}</li>
              <li>{t("landing.trust.lightning")}</li>
              <li>{t("landing.trust.diaspora")}</li>
            </ul>
          </section>

          {/* Features */}
          <section id="features" className="landing-shell scroll-mt-24 py-16 sm:py-20">
            <SectionHeading kicker={t("landing.features.kicker")} title={t("landing.features.title")} />
            <div className="grid gap-8 md:grid-cols-2">
              {FEATURES.map((f) => (
                <FeatureCard key={f.title} title={t(f.title)} body={t(f.body)} tone={f.tone} learn={t("landing.learn")} href={f.href} />
              ))}
            </div>
          </section>

          {/* How it works */}
          <section id="how" className="landing-shell scroll-mt-24 pb-16 sm:pb-20">
            <SectionHeading kicker={t("landing.how.kicker")} title={t("landing.how.title")} />
            <ol className="space-y-5">
              {STEPS.map((step, i) => {
                const open = openStep === i;
                return (
                  <li key={step.title}>
                    <button
                      type="button"
                      className={`landing-card w-full p-6 text-left transition-colors sm:p-8 ${open ? "bg-lime" : "bg-fog"}`}
                      aria-expanded={open}
                      onClick={() => setOpenStep(open ? -1 : i)}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex min-w-0 items-start gap-4 sm:gap-6">
                          <span className="text-[1.5rem] font-medium tabular-nums sm:text-[1.75rem]">{String(i + 1).padStart(2, "0")}</span>
                          <div className="min-w-0">
                            <h3 className="text-[1.15rem] font-medium sm:text-[1.4rem]">{t(step.title)}</h3>
                            {open ? <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-ink-strong/80 sm:text-[16px]">{t(step.body)}</p> : null}
                          </div>
                        </div>
                        <span
                          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-ink-strong bg-white text-xl leading-none"
                          aria-hidden
                        >
                          {open ? "−" : "+"}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>

          {/* CTA banner */}
          <section className="landing-shell pb-16 sm:pb-20">
            <div className="landing-card flex flex-col gap-8 bg-ink-strong p-8 text-white sm:p-12 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-xl">
                <h2 className="text-[1.75rem] leading-tight font-medium sm:text-[2.25rem]">{t("landing.banner.title")}</h2>
                <p className="mt-4 text-[15px] leading-relaxed text-white/75 sm:text-[16px]">{t("landing.banner.body")}</p>
              </div>
              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                <button type="button" className="landing-btn landing-btn-lime" onClick={() => start("home")} disabled={busy}>
                  {t("welcome.getStarted")}
                </button>
                <button
                  type="button"
                  className="landing-btn border border-white/40 bg-transparent text-white hover:bg-white/10"
                  onClick={() => start("invite")}
                  disabled={busy}
                >
                  {t("welcome.haveInvite")}
                </button>
              </div>
            </div>
          </section>
        </main>

        <footer className="landing-shell border-t border-ink-strong/15 py-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[18px] font-bold">
                {t("app.name")} <span className="font-semibold text-ink-strong/50">{t("app.on")}</span>
              </p>
              <p className="mt-2 max-w-md text-[13px] leading-relaxed text-ink-strong/60">{t("welcome.custody")}</p>
            </div>
            <p className="text-[13px] text-ink-strong/45">{t("landing.footer.rights")}</p>
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
