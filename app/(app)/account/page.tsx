"use client";

import { useRouter } from "next/navigation";
import { useApp } from "@/components/providers";
import { ErrorState, Header, Loading, MemberAvatar, PillButton, Screen } from "@/components/ui";
import { apiFetch, useApi } from "@/lib/client/api";
import type { Me } from "@/lib/client/types";

export default function AccountPage() {
  const { t, locale, setLocale } = useApp();
  const router = useRouter();
  const me = useApi<Me>("/api/me");

  if (me.error && !me.data) return <ErrorState error={me.error} onRetry={me.refetch} />;
  if (!me.data?.user) return <Loading />;

  const user = me.data.user;

  async function signOut() {
    await apiFetch("/api/auth/signout", { method: "POST" });
    router.push("/welcome");
  }

  return (
    <>
      <Header title={t("account.title")} />
      <Screen>
        <div className="flex items-center gap-4 rounded-[var(--radius-card)] bg-white p-4 shadow-[var(--shadow-card)]">
          <MemberAvatar name={user.displayName} size={56} />
          <div className="min-w-0">
            <p className="truncate text-lg font-extrabold text-forest">{user.displayName}</p>
            <p className="text-sm text-muted">{t("account.signedIn")}</p>
          </div>
        </div>

        <section className="mt-6 space-y-3">
          <h2 className="text-[13px] font-semibold tracking-wide text-muted uppercase">{t("account.preferences")}</h2>
          <button
            type="button"
            onClick={() => setLocale(locale === "en" ? "sw" : "en")}
            className="flex min-h-14 w-full items-center justify-between rounded-[var(--radius-card)] bg-white px-4 text-left shadow-[var(--shadow-card)]"
            lang={locale === "en" ? "sw" : "en"}
          >
            <span className="font-semibold">{t("account.language")}</span>
            <span className="rounded-full bg-sage px-3 py-1 text-sm font-semibold text-money">{t("common.language")}</span>
          </button>
        </section>

        <div className="mt-8">
          <PillButton variant="secondary" onClick={signOut}>
            {t("common.signOut")}
          </PillButton>
        </div>
      </Screen>
    </>
  );
}
