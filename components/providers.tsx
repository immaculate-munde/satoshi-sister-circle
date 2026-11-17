"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { en, type MessageKey } from "@/i18n/en";
import { sw } from "@/i18n/sw";

export type Locale = "en" | "sw";
export interface AppMode {
  provider: "demo" | "flash";
  simulatedPayments: boolean;
  live: boolean;
  bitcoinEnabled: boolean;
  network: string;
}

interface AppCtx {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
  mode: AppMode;
}

const Ctx = createContext<AppCtx | null>(null);
const catalogs = { en, sw };

export function AppProviders({ children, initialLocale, mode }: { children: ReactNode; initialLocale: Locale; mode: AppMode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    document.documentElement.lang = l;
    void fetch("/api/me/locale", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ locale: l }),
    });
  }, []);
  const t = useCallback(
    (key: MessageKey, vars?: Record<string, string | number>) => {
      let s: string = catalogs[locale][key] ?? en[key] ?? key;
      if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
      return s;
    },
    [locale],
  );
  const value = useMemo(() => ({ locale, setLocale, t, mode }), [locale, setLocale, t, mode]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useApp outside AppProviders");
  return c;
}

export const useT = () => useApp().t;
