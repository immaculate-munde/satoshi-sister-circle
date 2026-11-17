"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { Logo } from "@/components/art";
import { useT } from "@/components/providers";

const SPLASH_MS = 1200;

/** Soft brand splash, then landing. */
export default function Splash() {
  const router = useRouter();
  const t = useT();
  const done = useRef(false);
  const go = useCallback(() => {
    if (done.current) return;
    done.current = true;
    router.replace("/welcome");
  }, [router]);

  useEffect(() => {
    const timer = setTimeout(go, SPLASH_MS);
    return () => clearTimeout(timer);
  }, [go]);

  return (
    <main className="brand-page flex min-h-dvh flex-1 flex-col">
      <button
        onClick={go}
        className="relative flex min-h-dvh flex-1 flex-col items-center justify-center gap-5 overflow-hidden bg-paper px-8 text-center"
        aria-label={`${t("app.name")} ${t("app.on")}. ${t("app.tagline")} Tap to continue.`}
      >
        <div className="absolute inset-0 opacity-70" aria-hidden>
          <div className="brand-hero-blob !inset-[18%_12%_22%_12%]" />
        </div>
        <div className="relative z-[1] animate-fade-up">
          <Logo size={148} />
        </div>
        <div className="relative z-[1] animate-fade-up" style={{ animationDelay: "120ms" }}>
          <p className="text-[44px] leading-none font-extrabold tracking-tight text-forest sm:text-5xl">{t("app.name")}</p>
          <p className="mt-1 text-xl font-semibold text-btc">{t("app.on")}</p>
        </div>
        <p className="relative z-[1] animate-fade-up text-[15px] text-muted" style={{ animationDelay: "240ms" }}>
          {t("app.tagline")}
        </p>
      </button>
    </main>
  );
}
