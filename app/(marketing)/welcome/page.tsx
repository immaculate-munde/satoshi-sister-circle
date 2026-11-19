"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
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
import { supabaseEnabled } from "@/lib/client/supabase";
import type { MessageKey } from "@/i18n/en";
import type { ReactNode } from "react";

const SERVICES: { title: MessageKey; body: MessageKey; icon: ReactNode }[] = [
  { title: "landing.feature.ledger.title", body: "landing.feature.ledger.body", icon: <FeatureIconLedger /> },
  { title: "landing.feature.payout.title", body: "landing.feature.payout.body", icon: <FeatureIconPayout /> },
  { title: "landing.feature.lightning.title", body: "landing.feature.lightning.body", icon: <FeatureIconLightning /> },
  { title: "landing.feature.abroad.title", body: "landing.feature.abroad.body", icon: <FeatureIconAbroad /> },
];

/** Three staggered cards: each has a coloured tab, its text, and a photo (Pexels, see public/images/landing/CREDITS.md). */
const STEPS: { title: MessageKey; body: MessageKey; card: string; img: string; alt: string }[] = [
  {
    title: "landing.how.1.title",
    body: "landing.how.1.body",
    card: "bg-sage",
    img: "/images/landing/step-phone.jpg",
    alt: "A woman in Accra checks her phone outdoors",
  },
  {
    title: "landing.how.2.title",
    body: "landing.how.2.body",
    card: "bg-white",
    img: "/images/landing/step-market.jpg",
    alt: "Two market women selling flour at their stall",
  },
  {
    title: "landing.how.3.title",
    body: "landing.how.3.body",
    card: "bg-[#fbe3c0]",
    img: "/images/landing/step-mother.jpg",
    alt: "A smiling mother in Nigerian attire holding her baby",
  },
];

/** Small orange Lightning coin, the playful accent used where the reference design has an illustration. */
function CoinMark({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 120" aria-hidden>
      <circle cx="60" cy="60" r="52" fill="#f7931a" />
      <circle cx="60" cy="60" r="40" fill="none" stroke="#0a3d2e" strokeWidth="4" strokeDasharray="2 9" strokeLinecap="round" />
      <path d="M66 22 38 66h20l-6 32 30-46H62z" fill="#fff6e0" stroke="#0a3d2e" strokeWidth="3.5" strokeLinejoin="round" />
    </svg>
  );
}

function Landing() {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/home";
  const [signInOpen, setSignInOpen] = useState(!supabaseEnabled && params.get("signin") === "1");
  const [after, setAfter] = useState<"home" | "invite">("home");
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Bounced here by a 401 (or an old link)? Go to the real sign-in page.
  useEffect(() => {
    if (supabaseEnabled && params.get("signin") === "1") router.replace(`/signin?next=${encodeURIComponent(safeNext)}`);
  }, [params, router, safeNext]);

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
      if (supabaseEnabled) {
        router.push(`/signin?next=${encodeURIComponent(target === "invite" ? "/join" : safeNext)}`);
        return;
      }
      setSignInOpen(true);
    } finally {
      setBusy(false);
    }
  }

  const links = [
    { href: "#how", label: t("landing.nav.how") },
    { href: "#features", label: t("landing.nav.features") },
    { href: "#stories", label: t("landing.nav.stories") },
  ];

  return (
    <>
      <div className="min-h-dvh bg-paper pb-[env(safe-area-inset-bottom)] text-ink">
        {/* ───────────── Hero: full-bleed photo, giant script headline, floating pill nav ───────────── */}
        <section id="top" className="relative isolate flex min-h-[100svh] flex-col overflow-hidden bg-forest">
          <Image
            src="/images/landing/hero-market.jpg"
            alt="Two women trading at a busy market in warm afternoon light"
            fill
            priority
            sizes="100vw"
            className="-z-20 object-cover object-[60%_center]"
          />
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-forest/90 via-forest/55 to-forest/10" aria-hidden />
          <div className="absolute inset-x-0 bottom-0 -z-10 h-1/3 bg-gradient-to-t from-forest/70 to-transparent" aria-hidden />

          <header className="relative z-20 flex items-center justify-between gap-4 px-5 pt-5 sm:px-10 sm:pt-7">
            <a href="#top" className="flex items-center gap-2.5" aria-label={`${t("app.name")}: ${t("app.tagline")}`}>
              <Logo size={44} />
              <span className="text-[22px] leading-none font-extrabold tracking-tight text-white">
                {t("app.name")}
                <span className="mt-1 block text-[11px] font-semibold tracking-wide text-btc">{t("app.tagline")}</span>
              </span>
            </a>

            <nav aria-label={t("nav.primary")} className="hidden items-center gap-1 rounded-full bg-white px-3 py-2 shadow-[var(--shadow-card)] md:flex">
              {links.map((l) => (
                <a key={l.href} href={l.href} className="rounded-full px-4 py-2 text-[15px] font-semibold text-forest hover:bg-sage">
                  {l.label}
                </a>
              ))}
              <button
                type="button"
                onClick={() => start("home")}
                disabled={busy}
                className="ml-1 rounded-full bg-money px-5 py-2 text-[15px] font-bold text-white hover:bg-forest disabled:opacity-60"
              >
                {t("landing.nav.cta")}
              </button>
            </nav>

            <button
              type="button"
              className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white text-xl text-forest shadow-[var(--shadow-card)] md:hidden"
              aria-expanded={menuOpen}
              aria-label="Menu"
              onClick={() => setMenuOpen((v) => !v)}
            >
              <span aria-hidden>{menuOpen ? "×" : "☰"}</span>
            </button>
          </header>

          {menuOpen ? (
            <div className="relative z-20 mx-5 mt-3 flex flex-col gap-1 rounded-3xl bg-white p-3 shadow-[var(--shadow-soft)] md:hidden">
              {links.map((l) => (
                <a key={l.href} href={l.href} onClick={() => setMenuOpen(false)} className="min-h-12 rounded-2xl px-4 py-3 font-semibold text-forest hover:bg-sage">
                  {l.label}
                </a>
              ))}
              <button type="button" className="brand-btn brand-btn-primary mt-1 w-full" onClick={() => start("home")} disabled={busy}>
                {t("landing.nav.cta")}
              </button>
            </div>
          ) : null}

          <div className="relative z-10 flex flex-1 flex-col justify-end px-5 pt-10 pb-14 sm:px-10 sm:pb-20 lg:justify-center lg:pb-10">
            <div className="animate-fade-up max-w-4xl">
              <p className="mb-3 inline-block rounded-full bg-white/15 px-4 py-1.5 text-[13px] font-bold tracking-wide text-cream uppercase backdrop-blur">
                {t("landing.hero.kicker")}
              </p>
              <h1 className="font-display text-[3.4rem] leading-[0.98] text-cream drop-shadow-[0_4px_18px_rgba(0,0,0,0.35)] sm:text-[5.2rem] lg:text-[7rem]">
                {t("landing.hero.title")}
                <CoinMark className="ml-3 inline-block h-[0.8em] w-[0.8em] -translate-y-[0.08em] rotate-[14deg] align-middle" />
              </h1>
              <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-white/90 sm:text-[19px]">{t("landing.hero.body")}</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => start("home")}
                  disabled={busy}
                  className="inline-flex min-h-14 items-center justify-center rounded-full bg-sage px-8 text-[16px] font-bold text-forest transition hover:bg-white disabled:opacity-60"
                >
                  {busy && after === "home" ? t("common.loading") : t("welcome.getStarted")}
                </button>
                <button
                  type="button"
                  onClick={() => start("invite")}
                  disabled={busy}
                  className="inline-flex min-h-14 items-center justify-center rounded-full border-2 border-white/80 px-8 text-[16px] font-bold text-white transition hover:bg-white/15 disabled:opacity-60"
                >
                  {t("welcome.haveInvite")}
                </button>
              </div>
            </div>

            <div className="absolute right-5 bottom-6 hidden max-w-[15rem] flex-col gap-2 text-[13px] font-semibold text-forest sm:right-10 lg:flex">
              <span className="rounded-2xl bg-white px-4 py-3 shadow-[var(--shadow-card)]">
                <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-sage text-[11px] text-money" aria-hidden>
                  ✓
                </span>
                {t("landing.chip.paid")}
              </span>
              <span className="rounded-2xl bg-white px-4 py-3 shadow-[var(--shadow-card)]">
                <span className="mr-2 text-btc" aria-hidden>
                  ⚡
                </span>
                {t("landing.chip.payout")}
              </span>
            </div>
          </div>
        </section>

        {/* ───────────── Split: photo left, centred story right ───────────── */}
        <section className="mx-auto grid w-[min(100%-2.5rem,80rem)] items-center gap-10 py-16 sm:py-24 lg:grid-cols-[1fr_1fr] lg:gap-20">
          <div className="relative mx-auto aspect-[4/5] w-full max-w-xl overflow-hidden rounded-[28px] shadow-[var(--shadow-soft)]">
            <Image
              src="/images/landing/three-friends.jpg"
              alt="Three young women laughing together, wrapped in colourful fabric"
              fill
              sizes="(min-width: 1024px) 40vw, 90vw"
              className="object-cover"
            />
          </div>
          <div className="mx-auto max-w-lg text-center">
            <CoinMark className="mx-auto h-24 w-24 -rotate-6" />
            <h2 className="mt-6 text-[2.1rem] leading-tight font-extrabold tracking-tight text-forest sm:text-[2.8rem]">
              {t("welcome.title")}
            </h2>
            <p className="mt-6 text-[16px] leading-relaxed text-ink/80 sm:text-[18px]">{t("welcome.body")}</p>
            <p className="mt-6 text-[17px] font-bold text-money">{t("app.tagline")}</p>
          </div>
        </section>

        {/* ───────────── Steps: staggered tabbed cards on warm cream ───────────── */}
        <section id="how" className="scroll-mt-6 bg-[#f4ead3] py-16 sm:py-24">
          <div className="mx-auto w-[min(100%-2.5rem,80rem)]">
            <div className="flex items-start justify-between gap-6">
              <div className="max-w-xl">
                <p className="brand-kicker">{t("landing.how.kicker")}</p>
                <h2 className="mt-2 text-[2.2rem] leading-[1.08] font-extrabold tracking-tight text-forest sm:text-[3.2rem]">
                  {t("landing.how.title")}
                </h2>
              </div>
              <svg className="hidden h-28 w-32 shrink-0 sm:block" viewBox="0 0 140 120" aria-hidden>
                <ellipse cx="68" cy="60" rx="46" ry="42" fill="#0f6b4c" />
                <ellipse cx="68" cy="60" rx="64" ry="14" fill="none" stroke="#f7931a" strokeWidth="8" transform="rotate(-18 68 60)" />
                <path d="M62 36 48 62h12l-4 20 20-28H64z" fill="#fff6e0" />
              </svg>
            </div>

            <ol className="mt-12 grid items-start gap-10 lg:grid-cols-3 lg:gap-6">
              {STEPS.map((s, i) => (
                <li key={s.title} className={i === 0 ? "lg:mt-44" : i === 1 ? "lg:mt-24" : ""}>
                  <h3 className={`inline-block rounded-t-2xl px-5 pt-3 pb-3 text-[18px] font-extrabold text-forest ${s.card}`}>
                    {i + 1}. {t(s.title)}
                  </h3>
                  <div className={`rounded-b-[26px] rounded-tr-[26px] p-5 ${s.card}`}>
                    <p className="text-[15px] leading-relaxed text-ink/85">{t(s.body)}</p>
                    <div className="relative mt-5 aspect-[4/3] overflow-hidden rounded-2xl">
                      <Image src={s.img} alt={s.alt} fill sizes="(min-width: 1024px) 28vw, 90vw" className="object-cover" />
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ───────────── Features ───────────── */}
        <section id="features" className="mx-auto w-[min(100%-2.5rem,80rem)] scroll-mt-6 py-16 sm:py-24">
          <h2 className="mx-auto max-w-2xl text-center text-[2.1rem] leading-tight font-extrabold tracking-tight text-forest sm:text-[2.9rem]">
            {t("landing.features.title")}
          </h2>
          <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {SERVICES.map((s) => (
              <li key={s.title} className="rounded-[26px] bg-white p-7 shadow-[var(--shadow-card)]">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-sage">{s.icon}</div>
                <h3 className="mt-5 text-[18px] font-extrabold text-forest">{t(s.title)}</h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-muted">{t(s.body)}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* ───────────── Live preview of a round ───────────── */}
        <section className="mx-auto grid w-[min(100%-2.5rem,80rem)] items-center gap-10 pb-16 sm:pb-24 lg:grid-cols-2 lg:gap-16">
          <div className="order-2 lg:order-1">
            <div className="relative mx-auto w-full max-w-md">
              <div className="brand-soft-card relative z-[1] p-6 pb-16">
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
          </div>
          <div className="order-1 flex justify-center lg:order-2">
            <LandingHeroArt className="w-full max-w-[22rem] sm:max-w-[26rem]" />
          </div>
        </section>

        {/* ───────────── Photo band with the honest custody note ───────────── */}
        <section id="stories" className="relative isolate flex min-h-[26rem] scroll-mt-6 items-center justify-center overflow-hidden bg-forest px-6 py-20">
          <Image
            src="/images/landing/band-meeting.jpg"
            alt="Women of a savings circle meeting around a table"
            fill
            sizes="100vw"
            className="-z-20 object-cover"
          />
          <div className="absolute inset-0 -z-10 bg-forest/80" aria-hidden />
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-[14px] font-bold tracking-widest text-btc uppercase">{t("landing.nav.stories")}</p>
            <blockquote className="mt-5 text-[1.35rem] leading-snug font-bold text-white sm:text-[1.9rem]">{t("landing.quote")}</blockquote>
            <p className="mt-5 text-[16px] font-bold text-cream">{t("landing.quote.by")}</p>
          </div>
        </section>

        {/* ───────────── Closing call to action over a street photo ───────────── */}
        <section className="relative isolate flex min-h-[28rem] items-center justify-center overflow-hidden bg-forest px-6 py-20">
          <Image
            src="/images/landing/cta-street.jpg"
            alt="Neighbours gathered at a roadside fruit stall"
            fill
            sizes="100vw"
            className="-z-20 object-cover object-[center_75%]"
          />
          <div className="absolute inset-0 -z-10 bg-gradient-to-b from-forest/85 to-[#06271d]/90" aria-hidden />
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-[2.8rem] leading-tight text-cream sm:text-[4rem]">{t("landing.banner.title")}</h2>
            <p className="mt-4 text-[17px] leading-relaxed text-white/90">{t("landing.banner.body")}</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => start("home")}
                disabled={busy}
                className="inline-flex min-h-14 items-center justify-center rounded-full bg-sage px-8 text-[16px] font-bold text-forest transition hover:bg-white disabled:opacity-60"
              >
                {t("welcome.getStarted")}
              </button>
              <button
                type="button"
                onClick={() => start("invite")}
                disabled={busy}
                className="inline-flex min-h-14 items-center justify-center rounded-full border-2 border-white/80 px-8 text-[16px] font-bold text-white transition hover:bg-white/15 disabled:opacity-60"
              >
                {t("welcome.haveInvite")}
              </button>
            </div>
          </div>
        </section>

        {/* ───────────── Footer ───────────── */}
        <footer className="bg-paper">
          <div className="mx-auto w-[min(100%-2.5rem,80rem)] py-14 sm:py-20">
            <div className="flex items-center gap-4">
              <Logo size={64} />
              <span className="font-display text-[2.4rem] text-forest sm:text-[3rem]">
                {t("app.name")}
              </span>
            </div>
            <div className="mt-12 grid gap-10 text-[15px] text-ink/80 sm:grid-cols-2 lg:grid-cols-[1.2fr_0.7fr_1.4fr_0.8fr]">
              <p className="max-w-xs text-[17px] font-bold text-money">{t("app.tagline")}</p>
              <ul className="space-y-2 font-semibold">
                {links.map((l) => (
                  <li key={l.href}>
                    <a href={l.href} className="hover:text-money">
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
              <p className="max-w-md leading-relaxed">{t("welcome.custody")}</p>
              <p className="font-semibold text-forest">{t("landing.footer.rights")}</p>
            </div>
            <p className="mt-14 text-[13px] text-muted">
              © {new Date().getFullYear()} {t("app.name")}. Photos from{" "}
              <a href="https://www.pexels.com" className="underline underline-offset-2 hover:text-money" target="_blank" rel="noreferrer">
                Pexels
              </a>
              .
            </p>
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
