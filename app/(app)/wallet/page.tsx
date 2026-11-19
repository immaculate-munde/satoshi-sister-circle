"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { useApp } from "@/components/providers";
import { ErrorState, Loading, MemberAvatar, Screen, StatusBadge } from "@/components/ui";
import { useApi } from "@/lib/client/api";
import { kes, units } from "@/lib/client/format";
import type { ChamaList, Me } from "@/lib/client/types";

type Tab = "home" | "receive" | "history";

/** Wallet hub — e-wallet pattern, Chama brand, wired to existing chama flows. */
export default function WalletPage() {
  const { t } = useApp();
  const me = useApi<Me>("/api/me");
  const list = useApi<ChamaList>("/api/chamas");
  const [tab, setTab] = useState<Tab>("home");

  const due = useMemo(() => {
    const chamas = list.data?.chamas ?? [];
    return chamas.filter((c) => c.myStatus === "PENDING" || c.myStatus === "LATE");
  }, [list.data]);

  const paid = useMemo(() => {
    const chamas = list.data?.chamas ?? [];
    return chamas.filter((c) => c.myStatus === "PAID");
  }, [list.data]);

  const nextReceive = useMemo(() => {
    const chamas = list.data?.chamas ?? [];
    const name = me.data?.user?.displayName;
    if (!name) return null;
    return chamas.find((c) => c.status === "ACTIVE" && c.recipientName === name) ?? null;
  }, [list.data, me.data]);

  if (list.error && !list.data) return <ErrorState error={list.error} onRetry={list.refetch} />;
  if (!list.data || !me.data?.user) return <Loading />;

  const user = me.data.user;
  const totals = list.data.totals;
  const firstActive = list.data.chamas.find((c) => c.status === "ACTIVE");
  const payHref = due.length === 1 ? `/chamas/${due[0].id}/contribute` : null;

  function goPay() {
    setTab("home");
    queueMicrotask(() => document.getElementById("due")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  return (
    <div className="flex flex-1 flex-col">
      {/* Balance header */}
      <header className="relative overflow-hidden bg-forest px-5 pb-14 pt-5 text-white">
        <div className="absolute -top-8 -right-6 h-36 w-36 rounded-full bg-pink/40" aria-hidden />
        <div className="absolute -bottom-10 -left-8 h-32 w-32 rounded-full bg-btc/30" aria-hidden />
        <div className="relative flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-cream/80">{t("home.greeting", { name: user.displayName.split(" ")[0] })}</p>
            <h1 className="text-[20px] font-extrabold tracking-tight">{t("wallet.title")}</h1>
          </div>
          <Link href="/account" className="rounded-full ring-2 ring-white/30" aria-label={t("nav.account")}>
            <MemberAvatar name={user.displayName} size={42} />
          </Link>
        </div>
        <div className="relative mt-6">
          <p className="text-[13px] font-medium text-cream/75">{t("wallet.balance")}</p>
          <p className="mt-1 text-[34px] leading-none font-extrabold tracking-tight">{kes(totals.kesMinorAtContribution)}</p>
          <p className="mt-2 text-[13px] text-cream/75">
            {units(totals.btcSats, "BTC_SAT")}
            {totals.usdCents !== "0" ? ` · ${units(totals.usdCents, "USD_CENT")}` : ""}
          </p>
          <p className="mt-3 text-[12px] font-semibold text-pink">{t("wallet.balanceHint")}</p>
        </div>
      </header>

      {/* Quick actions overlay */}
      <div className="relative z-[1] -mt-8 px-5">
        <div className="grid grid-cols-4 gap-2 rounded-[24px] bg-white p-3 shadow-[var(--shadow-card)]">
          <QuickAction
            href={payHref ?? undefined}
            label={t("wallet.pay")}
            onClick={payHref ? undefined : goPay}
            icon={
              <path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            }
          />
          <QuickAction
            label={t("wallet.receive")}
            onClick={() => setTab("receive")}
            icon={
              <path d="M12 5v14M5 12l7 7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            }
          />
          <QuickAction
            label={t("wallet.history")}
            onClick={() => setTab("history")}
            icon={
              <>
                <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" fill="none" />
                <path d="M12 8v4l2.5 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
              </>
            }
          />
          <QuickAction
            href="/join"
            label={t("wallet.join")}
            icon={
              <>
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" fill="none" />
                <circle cx="9" cy="7" r="3.5" stroke="currentColor" strokeWidth="2" fill="none" />
                <path d="M19 8v6M22 11h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </>
            }
          />
        </div>
      </div>

      <Screen className="pt-5">
        {tab === "receive" ? (
          <section className="space-y-4">
            <h2 className="text-[17px] font-bold text-forest">{t("wallet.receiveTitle")}</h2>
            <p className="text-[14px] leading-relaxed text-muted">{t("wallet.receiveBody")}</p>
            {nextReceive ? (
              <div className="rounded-[22px] bg-sage p-4">
                <p className="font-semibold text-forest">{t("wallet.youAreNext", { name: nextReceive.name })}</p>
                <Link href={`/chamas/${nextReceive.id}`} className="mt-3 inline-flex min-h-11 items-center font-semibold text-money">
                  {t("wallet.receiveOpen")} →
                </Link>
              </div>
            ) : firstActive ? (
              <Link href={`/chamas/${firstActive.id}`} className="inline-flex min-h-11 items-center font-semibold text-money">
                {t("wallet.receiveOpen")} →
              </Link>
            ) : (
              <Link href="/chamas/new" className="inline-flex min-h-11 items-center font-semibold text-money">
                {t("wallet.create")} →
              </Link>
            )}
            <button type="button" className="text-sm font-semibold text-muted" onClick={() => setTab("home")}>
              ← {t("common.back")}
            </button>
          </section>
        ) : null}

        {tab === "history" ? (
          <section className="space-y-4">
            <h2 className="text-[17px] font-bold text-forest">{t("wallet.history")}</h2>
            {paid.length === 0 ? (
              <p className="text-[14px] text-muted">{t("wallet.activityEmpty")}</p>
            ) : (
              <ul className="space-y-2">
                {paid.map((c) => (
                  <li key={c.id}>
                    <Link href={`/chamas/${c.id}`} className="flex min-h-14 items-center justify-between rounded-2xl bg-white px-4 shadow-[var(--shadow-card)]">
                      <span className="font-semibold text-forest">{c.name}</span>
                      <StatusBadge status="PAID" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <button type="button" className="text-sm font-semibold text-muted" onClick={() => setTab("home")}>
              ← {t("common.back")}
            </button>
          </section>
        ) : null}

        {tab === "home" ? (
          <>
            {/* Action grid */}
            <h2 className="mb-3 text-[17px] font-bold text-forest">{t("wallet.actions")}</h2>
            <ul className="grid grid-cols-4 gap-3">
              <GridTile href={payHref ?? "/home"} label={t("wallet.pay")} bg="bg-sage" color="text-money" onClick={payHref ? undefined : goPay} />
              <GridTile href={firstActive ? `/chamas/${firstActive.id}/diaspora` : "/join"} label={t("wallet.diaspora")} bg="bg-warn-wash" color="text-[#8a4b00]" />
              <GridTile href="/chamas/new" label={t("wallet.create")} bg="bg-forest/10" color="text-forest" />
              <GridTile href="/home" label={t("wallet.moreHome")} bg="bg-btc/15" color="text-forest" />
            </ul>

            {/* Due now */}
            <div id="due" className="mt-8 scroll-mt-24">
              <h2 className="mb-3 text-[17px] font-bold text-forest">{t("wallet.due")}</h2>
              {due.length === 0 ? (
                <p className="rounded-[22px] bg-sage/60 px-4 py-3 text-[14px] text-forest">{t("wallet.dueEmpty")}</p>
              ) : (
                <ul className="space-y-2">
                  {due.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/chamas/${c.id}/contribute`}
                        className="flex min-h-16 items-center gap-3 rounded-[22px] bg-white px-4 py-3 shadow-[var(--shadow-card)]"
                      >
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-money text-base font-extrabold text-white">
                          {c.name[0]}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-bold text-forest">{c.name}</span>
                          <span className="block text-[13px] text-muted">
                            {kes(c.contributionKesMinor)} · {t("common.round", { n: c.round })}
                          </span>
                        </span>
                        {c.myStatus ? <StatusBadge status={c.myStatus} /> : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Recent circles */}
            <div className="mt-8 mb-2">
              <h2 className="mb-3 text-[17px] font-bold text-forest">{t("wallet.activity")}</h2>
              {list.data.chamas.length === 0 ? (
                <p className="text-[14px] text-muted">{t("home.empty")}</p>
              ) : (
                <ul className="space-y-2">
                  {list.data.chamas.slice(0, 4).map((c) => (
                    <li key={c.id}>
                      <Link href={`/chamas/${c.id}`} className="flex min-h-14 items-center justify-between rounded-2xl bg-white px-4 shadow-[var(--shadow-card)]">
                        <span className="truncate font-semibold text-forest">{c.name}</span>
                        <span className="text-[13px] text-muted">
                          {c.paidCount}/{c.totalCount}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        ) : null}
      </Screen>
    </div>
  );
}

function QuickAction({
  href,
  label,
  icon,
  onClick,
}: {
  href?: string;
  label: string;
  icon: ReactNode;
  onClick?: () => void;
}) {
  const className = "flex flex-col items-center gap-1.5 rounded-2xl px-1 py-2 text-center hover:bg-sage/50";
  const body = (
    <>
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-sage text-money">
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
          {icon}
        </svg>
      </span>
      <span className="text-[11px] font-semibold text-forest">{label}</span>
    </>
  );
  if (href && !onClick) {
    return (
      <Link href={href} className={className}>
        {body}
      </Link>
    );
  }
  return (
    <button type="button" className={className} onClick={onClick}>
      {body}
    </button>
  );
}

function GridTile({
  href,
  label,
  bg,
  color,
  onClick,
}: {
  href: string;
  label: string;
  bg: string;
  color: string;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <span className={`mx-auto flex h-12 w-12 items-center justify-center rounded-2xl ${bg} ${color} text-lg font-extrabold`} aria-hidden>
        {label[0]}
      </span>
      <span className="mt-2 block text-[11px] font-semibold text-forest">{label}</span>
    </>
  );
  if (onClick) {
    return (
      <li>
        <button type="button" onClick={onClick} className="w-full rounded-2xl p-2 text-center hover:bg-paper">
          {inner}
        </button>
      </li>
    );
  }
  return (
    <li>
      <Link href={href} className="block rounded-2xl p-2 text-center hover:bg-paper">
        {inner}
      </Link>
    </li>
  );
}
