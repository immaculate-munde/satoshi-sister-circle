"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { Logo } from "@/components/art";
import { useT } from "@/components/providers";

const SPLASH_MS = 1500;

/** 01 Splash (Figma 2:2). Advances once, on tap or after ~1.5s. */
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
    <main className="flex flex-1 flex-col">
      <button
        onClick={go}
        className="flex flex-1 flex-col items-center justify-center gap-5 bg-paper px-8 text-center"
        aria-label={`${t("app.name")} ${t("app.on")}. ${t("app.tagline")} Tap to continue.`}
      >
        <div className="animate-fade-up">
          <Logo size={148} />
        </div>
        <div className="animate-fade-up" style={{ animationDelay: "120ms" }}>
          <p className="text-[44px] leading-none font-extrabold tracking-tight text-forest">{t("app.name")}</p>
          <p className="mt-1 text-xl font-semibold text-btc">{t("app.on")}</p>
        </div>
        <p className="animate-fade-up text-[15px] text-muted" style={{ animationDelay: "240ms" }}>
          {t("app.tagline")}
        </p>
      </button>
    </main>
  );
}
