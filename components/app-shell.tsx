"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode } from "react";
import { Logo } from "@/components/art";
import { IconAccount, IconHome, IconJoin, IconPlus } from "@/components/nav-icons";
import { useT } from "@/components/providers";

const NAV = [
  {
    href: "/home",
    labelKey: "nav.home" as const,
    Icon: IconHome,
    match: (p: string) => p === "/home" || (p.startsWith("/chamas/") && p !== "/chamas/new"),
  },
  { href: "/chamas/new", labelKey: "nav.create" as const, Icon: IconPlus, match: (p: string) => p === "/chamas/new" },
  { href: "/join", labelKey: "nav.join" as const, Icon: IconJoin, match: (p: string) => p === "/join" || p.startsWith("/join/") },
  { href: "/account", labelKey: "nav.account" as const, Icon: IconAccount, match: (p: string) => p === "/account" },
];

/** Focused payment / receipt flows: no chrome. */
export function isFocusPath(pathname: string) {
  if (pathname.includes("/contribute")) return true;
  if (pathname.startsWith("/payments/")) return true;
  if (pathname.startsWith("/receipts/")) return true;
  return false;
}

function activeHref(pathname: string) {
  // Prefer the most specific match (create/join/account over home's chama catch-all).
  const ranked = [...NAV].sort((a, b) => b.href.length - a.href.length);
  return ranked.find((item) => item.match(pathname))?.href ?? null;
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/";
  const t = useT();
  const focus = isFocusPath(pathname);
  const current = activeHref(pathname);

  if (focus) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-paper sm:shadow-[0_0_0_1px_#dfe8e3]">
        {children}
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh w-full bg-paper [--chrome-bottom:4.5rem] md:[--chrome-bottom:0px]">
      {/* Desktop sidebar */}
      <aside className="no-print sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-white px-3 py-5 md:flex lg:w-64">
        <Link href="/home" className="mb-8 flex items-center gap-2.5 px-2" aria-label={`${t("app.name")} ${t("app.on")}`}>
          <Logo size={36} />
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-extrabold leading-tight text-forest">{t("app.name")}</span>
            <span className="block truncate text-[12px] font-semibold text-btc">{t("app.on")}</span>
          </span>
        </Link>
        <nav aria-label={t("nav.primary")} className="flex flex-1 flex-col gap-1">
          {NAV.map(({ href, labelKey, Icon }) => {
            const active = current === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-12 items-center gap-3 rounded-2xl px-3 text-[15px] font-semibold transition-colors ${
                  active ? "bg-sage text-money" : "text-ink/80 hover:bg-sage/70 hover:text-money"
                }`}
              >
                <Icon className="shrink-0" />
                {t(labelKey)}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main column */}
      <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
          {children}
        </div>
      </div>

      {/* Mobile bottom nav */}
      <nav
        aria-label={t("nav.primary")}
        className="no-print safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 backdrop-blur md:hidden"
      >
        <ul className="mx-auto grid max-w-2xl grid-cols-4">
          {NAV.map(({ href, labelKey, Icon }) => {
            const active = current === href;
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-semibold ${
                    active ? "text-money" : "text-muted"
                  }`}
                >
                  <Icon />
                  <span className="truncate">{t(labelKey)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
