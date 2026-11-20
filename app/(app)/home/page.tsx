"use client";

import Link from "next/link";
import { useApp } from "@/components/providers";
import { ErrorState, Loading, MemberAvatar, PillLink, Screen } from "@/components/ui";
import { ChamaCard } from "@/features/chamas/chama-card";
import { useApi } from "@/lib/client/api";
import { kes, units } from "@/lib/client/format";
import type { ChamaList, Me } from "@/lib/client/types";

/** 03 Home - My Chamas (Figma 3:2). All figures derive from persisted records. */
export default function HomePage() {
  const { t } = useApp();
  const me = useApi<Me>("/api/me");
  const list = useApi<ChamaList>("/api/chamas");

  if (list.error && !list.data) return <ErrorState error={list.error} onRetry={list.refetch} />;
  if (!list.data || !me.data?.user) return <Loading />;

  const name = me.data.user.displayName;
  const active = list.data.chamas.filter((c) => c.status === "ACTIVE");
  const totals = list.data.totals;
  const diasporaTarget = active[0]?.id;

  const totalCard = (
    <div className="relative overflow-hidden rounded-[28px] bg-forest p-5 text-white shadow-[var(--shadow-card)]">
      <div className="absolute -top-8 -right-6 h-28 w-28 rounded-full bg-pink/35" aria-hidden />
      <div className="absolute -bottom-10 left-10 h-24 w-24 rounded-full bg-btc/25" aria-hidden />
      <div className="relative">
        <p className="text-[13px] font-medium text-cream/80">{t("home.totalSaved")}</p>
        <p className="mt-1 text-[32px] leading-none font-extrabold">{kes(totals.kesMinorAtContribution)}</p>
        <p className="mt-2 text-[13px] text-cream/80">
          {units(totals.btcSats, "BTC_SAT")}
          {totals.usdCents !== "0" ? ` · ${units(totals.usdCents, "USD_CENT")}` : ""}
        </p>
        <p className="mt-3 text-[12px] font-semibold text-pink">{t("home.totalSavedHint")} →</p>
      </div>
    </div>
  );

  return (
    <Screen className="pt-4">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[28px] font-extrabold">{t("home.greeting", { name: name.split(" ")[0] })}</h1>
          <p className="text-[14px] text-muted">{active.length === 1 ? t("home.active1") : t("home.active", { n: active.length })}</p>
        </div>
        <Link href="/account" className="flex h-11 w-11 items-center justify-center rounded-full" aria-label={t("nav.account")}>
          <MemberAvatar name={name} size={40} />
        </Link>
      </div>

      <div className="mt-5">
        {diasporaTarget ? (
          <Link href={`/chamas/${diasporaTarget}/diaspora`} aria-label={`${t("home.totalSaved")} ${kes(totals.kesMinorAtContribution)}. ${t("ledger.payFromAbroad")}`}>
            {totalCard}
          </Link>
        ) : (
          totalCard
        )}
      </div>

      <Link href="/sense" className="mt-4 block rounded-[24px] border border-line bg-white p-4 shadow-[var(--shadow-card)]">
        <p className="text-[15px] font-bold text-forest">{t("sense.homeTitle")}</p>
        <p className="mt-1 text-[13px] leading-5 text-muted">{t("sense.homeBody")}</p>
        <p className="mt-2 text-[13px] font-semibold text-money">{t("sense.open")} →</p>
      </Link>

      <div className="mt-6 mb-3 flex items-center justify-between">
        <h2 className="text-[17px] font-bold">{t("home.myChamas")}</h2>
        <Link href="/chamas/new" className="inline-flex min-h-11 items-center gap-1 rounded-full bg-money px-4 text-sm font-semibold text-white">
          <span aria-hidden>+</span> {t("home.create")}
        </Link>
      </div>

      {list.data.chamas.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-dashed border-money/30 bg-white p-6 text-center">
          <p className="text-[15px] text-muted">{t("home.empty")}</p>
          <div className="mt-4 space-y-2">
            <PillLink href="/chamas/new">{t("home.create")}</PillLink>
            <PillLink href="/join" variant="secondary">
              {t("home.join")}
            </PillLink>
          </div>
        </div>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {list.data.chamas.map((c) => (
            <li key={c.id}>
              <ChamaCard c={c} />
            </li>
          ))}
        </ul>
      )}
      {list.data.chamas.length > 0 ? (
        <Link href="/join" className="mx-auto mt-4 inline-flex min-h-11 items-center px-4 text-sm font-semibold text-money">
          {t("welcome.haveInvite")}
        </Link>
      ) : null}
    </Screen>
  );
}
