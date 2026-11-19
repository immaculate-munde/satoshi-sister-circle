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
const STEPS: { title: MessageKey; body: MessageKey; card: string; badge: string; img: string; alt: string }[] = [
  {
    title: "landing.how.1.title",
    body: "landing.how.1.body",
    card: "bg-white text-forest",
    badge: "bg-money text-white",
    img: "/images/landing/step-phone.jpg",
    alt: "A woman in Accra checks her phone outdoors",
  },
  {
    title: "landing.how.2.title",
    body: "landing.how.2.body",
    card: "bg-sage text-forest",
    badge: "bg-forest text-white",
    img: "/images/landing/step-market.jpg",
    alt: "Two market women selling flour at their stall",
  },
  {
    title: "landing.how.3.title",
    body: "landing.how.3.body",
    card: "bg-forest text-white",
    badge: "bg-btc text-forest",
    img: "/images/landing/step-mother.jpg",
    alt: "A smiling mother in Nigerian attire holding her baby",
  },
];

/** Orange Lightning coin from the deck: the warm accent next to a navy headline. */
function CoinMark({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 120" aria-hidden>
      <circle cx="60" cy="60" r="52" fill="#fe6f01" />
      <circle cx="60" cy="60" r="40" fill="none" stroke="#21212e" strokeWidth="4" strokeDasharray="2 9" strokeLinecap="round" />
      <path d="M66 22 38 66h20l-6 32 30-46H62z" fill="#fff7fb" stroke="#21212e" strokeWidth="3.5" strokeLinejoin="round" />
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
      <div className="min-h-dvh bg-white pb-[env(safe-area-inset-bottom)] text-ink">
        <div className="kente-rail fixed inset-y-0 left-0 z-30 hidden w-3 sm:block" aria-hidden />

        <section id="top" className="relative overflow-hidden">
          <div className="brand-blob -top-24 right-[-6rem] h-80 w-80" aria-hidden />
          <div className="brand-blob top-40 -left-24 h-56 w-56 opacity-70" aria-hidden />

          <header className="relative z-20 flex items-center justify-between gap-4 px-5 pt-5 sm:px-10 sm:pt-7 lg:pl-14">
            <a href="#top" className="flex items-center gap-2.5" aria-label={`${t("app.name")}: ${t("app.tagline")}`}>
              <Logo size={44} />
              <span className="text-[22px] leading-none font-extrabold tracking-tight text-forest">
                {t("app.name")}
                <span className="mt-1 block text-[11px] font-semibold tracking-wide text-money">{t("app.tagline")}</span>
              </span>
            </a>

            <nav aria-label={t("nav.primary")} className="hidden items-center gap-1 rounded-full border border-line bg-white px-3 py-2 shadow-[var(--shadow-card)] md:flex">
              {links.map((l) => (
                <a key={l.href} href={l.href} className="rounded-full px-4 py-2 text-[15px] font-semibold text-forest hover:bg-sage">
                  {l.label}
                </a>
              ))}
              <button
                type="button"
                onClick={() => start("home")}
                disabled={busy}
                className="ml-1 rounded-full bg-money px-5 py-2 text-[15px] font-bold text-white hover:bg-money-deep disabled:opacity-60"
              >
                {t("landing.nav.cta")}
              </button>
            </nav>

            <button
              type="button"
              className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-line bg-white text-xl text-forest shadow-[var(--shadow-card)] md:hidden"
              aria-expanded={menuOpen}
              aria-label="Menu"
              onClick={() => setMenuOpen((v) => !v)}
            >
              <span aria-hidden>{menuOpen ? "×" : "☰"}</span>
            </button>
          </header>

          {menuOpen ? (
            <div className="relative z-20 mx-5 mt-3 flex flex-col gap-1 rounded-3xl border border-line bg-white p-3 shadow-[var(--shadow-soft)] md:hidden">
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

          <div className="relative z-10 mx-auto grid w-[min(100%-2.5rem,80rem)] items-center gap-10 py-12 sm:py-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:py-20 lg:pl-6">
            <div className="animate-fade-up max-w-xl">
              <p className="brand-kicker">{t("landing.hero.kicker")}</p>
              <h1 className="mt-4 text-[2.8rem] leading-[1.02] font-extrabold text-forest sm:text-[3.6rem] lg:text-[4.4rem]">
                {t("landing.hero.title")}
                <CoinMark className="ml-3 inline-block h-[0.72em] w-[0.72em] -translate-y-[0.06em] rotate-[12deg] align-middle" />
              </h1>
              <p className="mt-5 max-w-lg text-[17px] leading-relaxed text-muted sm:text-[18px]">{t("landing.hero.body")}</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button type="button" onClick={() => start("home")} disabled={busy} className="brand-btn brand-btn-primary">
                  {busy && after === "home" ? t("common.loading") : t("welcome.getStarted")}
                </button>
                <button type="button" onClick={() => start("invite")} disabled={busy} className="brand-btn brand-btn-outline">
                  {t("welcome.haveInvite")}
                </button>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-lg">
              <div className="absolute -inset-6 -z-10 rounded-[40%] bg-sage" aria-hidden />
              <div className="relative aspect-[4/5] overflow-hidden rounded-[32px] shadow-[var(--shadow-soft)]">
                <Image
                  src="/images/landing/hero-market.jpg"
                  alt="Two women trading at a busy market in warm afternoon light"
                  fill
                  priority
                  sizes="(min-width: 1024px) 40vw, 90vw"
                  className="object-cover object-[60%_center]"
                />
              </div>
              <div className="absolute bottom-6 left-4 flex max-w-[16rem] flex-col gap-2 text-[13px] font-semibold text-forest sm:left-6">
                <span className="rounded-2xl bg-white px-4 py-3 shadow-[var(--shadow-card)]">
                  <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-sage text-[11px] text-money" aria-hidden>
                    ✓
                  </span>
                  {t("landing.chip.paid")}
                </span>
                <span className="w-fit rounded-2xl bg-white px-4 py-3 shadow-[var(--shadow-card)]">
                  <span className="mr-2 text-btc" aria-hidden>
                    ⚡
                  </span>
                  {t("landing.chip.payout")}
                </span>
              </div>
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
          <div className="max-w-lg">
            <CoinMark className="h-20 w-20 -rotate-6" />
            <h2 className="mt-6 text-[2.1rem] leading-tight font-extrabold text-forest sm:text-[2.8rem]">{t("welcome.title")}</h2>
            <p className="mt-5 text-[16px] leading-relaxed text-muted sm:text-[18px]">{t("welcome.body")}</p>
            <p className="mt-6 text-[17px] font-bold text-money">{t("app.tagline")}</p>
          </div>
        </section>

        {/* ───────────── Steps: staggered tabbed cards on warm cream ───────────── */}
        <section id="how" className="scroll-mt-6 bg-sage py-16 sm:py-24">
          <div className="mx-auto w-[min(100%-2.5rem,80rem)]">
            <div className="flex items-end justify-between gap-6">
              <div className="max-w-xl">
                <p className="brand-kicker">{t("landing.how.kicker")}</p>
                <h2 className="mt-3 text-[2.2rem] leading-[1.08] font-extrabold text-forest sm:text-[3.2rem]">{t("landing.how.title")}</h2>
              </div>
              <CoinMark className="hidden h-24 w-24 shrink-0 -rotate-12 sm:block" />
            </div>

            <ol className="mt-12 grid items-stretch gap-5 lg:grid-cols-3">
              {STEPS.map((s, i) => (
                <li key={s.title} className={`flex flex-col overflow-hidden rounded-[28px] shadow-[var(--shadow-card)] ${s.card}`}>
                  <div className="flex flex-1 flex-col p-6">
                    <span className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-extrabold ${s.badge}`}>{i + 1}</span>
                    <h3 className="mt-4 text-[1.25rem] font-extrabold">{t(s.title)}</h3>
                    <p className={`mt-2 text-[15px] leading-relaxed ${s.card.includes("text-white") ? "text-white/80" : "text-muted"}`}>{t(s.body)}</p>
                  </div>
                  <div className="relative mx-5 mb-5 aspect-[4/3] overflow-hidden rounded-2xl">
                    <Image src={s.img} alt={s.alt} fill sizes="(min-width: 1024px) 28vw, 90vw" className="object-cover" />
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
                <div className="flex h-16 w-16 items-center justify-center">{s.icon}</div>
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
                <div className="relative mt-5 overflow-hidden rounded-2xl bg-forest p-4 text-white">
                  <div className="absolute -top-6 -right-4 h-16 w-16 rounded-full bg-pink/40" aria-hidden />
                  <p className="text-[12px] text-cream/80">{t("home.totalSaved")}</p>
                  <p className="relative mt-1 text-2xl font-extrabold text-pink">KES 10,000</p>
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
          <div className="absolute inset-0 -z-10 bg-forest/82" aria-hidden />
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-[0.8rem] font-bold tracking-[0.14em] text-pink uppercase">{t("landing.nav.stories")}</p>
            <blockquote className="mt-5 text-[1.45rem] leading-snug font-extrabold text-white sm:text-[2.1rem]">{t("landing.quote")}</blockquote>
            <p className="mt-5 text-[16px] font-bold text-cream">{t("landing.quote.by")}</p>
          </div>
        </section>

        {/* ───────────── Closing call to action over a street photo ───────────── */}
        <section className="bg-paper px-5 py-16 sm:px-10 sm:py-24">
          <div className="mx-auto grid w-[min(100%,80rem)] items-center gap-10 overflow-hidden rounded-[36px] bg-forest px-6 py-10 text-white sm:px-12 sm:py-14 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <p className="text-[0.8rem] font-bold tracking-[0.14em] text-pink uppercase">{t("app.tagline")}</p>
              <h2 className="mt-3 text-[2.4rem] leading-tight font-extrabold sm:text-[3.4rem]">{t("landing.banner.title")}</h2>
              <p className="mt-4 max-w-md text-[17px] leading-relaxed text-cream/90">{t("landing.banner.body")}</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button type="button" onClick={() => start("home")} disabled={busy} className="brand-btn bg-pink text-forest hover:bg-white">
                  {t("welcome.getStarted")}
                </button>
                <button
                  type="button"
                  onClick={() => start("invite")}
                  disabled={busy}
                  className="brand-btn border border-white/30 bg-transparent text-white hover:bg-white/10"
                >
                  {t("welcome.haveInvite")}
                </button>
              </div>
            </div>
            <div className="relative aspect-[4/3] overflow-hidden rounded-[28px]">
              <Image
                src="/images/landing/cta-street.jpg"
                alt="Neighbours gathered at a roadside fruit stall"
                fill
                sizes="(min-width: 1024px) 36vw, 90vw"
                className="object-cover object-[center_75%]"
              />
            </div>
          </div>
        </section>

        {/* ───────────── Footer ───────────── */}
        <footer className="bg-white">
          <div className="kente-rule" aria-hidden />
          <div className="mx-auto w-[min(100%-2.5rem,80rem)] py-14 sm:py-20">
            <div className="flex items-center gap-4">
              <Logo size={56} />
              <span className="text-[2.2rem] font-extrabold text-forest sm:text-[2.6rem]">{t("app.name")}</span>
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
