"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useApp } from "@/components/providers";
import { ErrorState, Loading, MemberAvatar, PillButton, PillLink, Screen } from "@/components/ui";
import { ChamaCard } from "@/features/chamas/chama-card";
import { InviteDialog } from "@/features/chamas/invite-dialog";
import { apiFetch, useApi } from "@/lib/client/api";
import { kes, units } from "@/lib/client/format";
import type { ChamaList, Me } from "@/lib/client/types";

/** 03 Home - My Chamas (Figma 3:2). All figures derive from persisted records. */
export default function HomePage() {
  const { t, locale, setLocale } = useApp();
  const router = useRouter();
  const me = useApi<Me>("/api/me");
  const list = useApi<ChamaList>("/api/chamas");
  const [inviteOpen, setInviteOpen] = useState(false);

  if (list.error && !list.data) return <ErrorState error={list.error} onRetry={list.refetch} />;
  if (!list.data || !me.data?.user) return <Loading />;

  const name = me.data.user.displayName;
  const active = list.data.chamas.filter((c) => c.status === "ACTIVE");
  const totals = list.data.totals;
  const diasporaTarget = active[0]?.id;

  async function signOut() {
    await apiFetch("/api/auth/signout", { method: "POST" });
    router.push("/welcome");
  }

  const totalCard = (
    <div className="rounded-[var(--radius-card)] bg-forest p-5 text-white shadow-[var(--shadow-card)]">
      <p className="text-[13px] font-medium text-cream/80">{t("home.totalSaved")}</p>
      <p className="mt-1 text-[32px] leading-none font-extrabold">{kes(totals.kesMinorAtContribution)}</p>
      <p className="mt-2 text-[13px] text-cream/80">
        {units(totals.btcSats, "BTC_SAT")}
        {totals.usdCents !== "0" ? ` · ${units(totals.usdCents, "USD_CENT")}` : ""}
      </p>
      <p className="mt-3 text-[12px] text-btc">{t("home.totalSavedHint")} →</p>
    </div>
  );

  return (
    <Screen className="pt-4">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[24px] font-extrabold tracking-tight">{t("home.greeting", { name: name.split(" ")[0] })}</h1>
          <p className="text-[14px] text-muted">{active.length === 1 ? t("home.active1") : t("home.active", { n: active.length })}</p>
        </div>
        <button onClick={() => setLocale(locale === "en" ? "sw" : "en")} className="min-h-11 rounded-full border border-line bg-white px-3 text-xs font-semibold" lang={locale === "en" ? "sw" : "en"}>
          {t("common.language")}
        </button>
        <details className="relative">
          <summary className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-full" aria-label={`${name} menu`}>
            <MemberAvatar name={name} size={40} />
          </summary>
          <div className="absolute right-0 z-10 mt-2 w-44 rounded-2xl bg-white p-2 shadow-[var(--shadow-card)]">
            <button onClick={signOut} className="min-h-11 w-full rounded-xl px-3 text-left text-sm hover:bg-sage">
              {t("common.signOut")}
            </button>
          </div>
        </details>
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

      <div className="mt-6 mb-3 flex items-center justify-between">
        <h2 className="text-[17px] font-bold">{t("home.myChamas")}</h2>
        <Link href="/chamas/new" className="inline-flex min-h-11 items-center gap-1 rounded-full bg-sage px-4 text-sm font-semibold text-money">
          <span aria-hidden>+</span> {t("home.create")}
        </Link>
      </div>

      {list.data.chamas.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-dashed border-money/30 bg-white p-6 text-center">
          <p className="text-[15px] text-muted">{t("home.empty")}</p>
          <div className="mt-4 space-y-2">
            <PillLink href="/chamas/new">{t("home.create")}</PillLink>
            <PillButton variant="secondary" onClick={() => setInviteOpen(true)}>
              {t("home.join")}
            </PillButton>
          </div>
        </div>
      ) : (
        <ul className="space-y-3">
          {list.data.chamas.map((c) => (
            <li key={c.id}>
              <ChamaCard c={c} />
            </li>
          ))}
        </ul>
      )}
      {list.data.chamas.length > 0 ? (
        <button onClick={() => setInviteOpen(true)} className="mx-auto mt-4 min-h-11 px-4 text-sm font-semibold text-money">
          {t("welcome.haveInvite")}
        </button>
      ) : null}
      <InviteDialog open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </Screen>
  );
}
