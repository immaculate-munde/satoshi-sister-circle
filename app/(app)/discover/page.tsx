"use client";

import Link from "next/link";
import { useState } from "react";
import { useApp } from "@/components/providers";
import { Card, ErrorState, Header, InlineError, Loading, PillButton, Screen } from "@/components/ui";
import { apiFetch, useApi } from "@/lib/client/api";
import { frequencyLabel, kes } from "@/lib/client/format";
import { assetLabel } from "@/lib/money";

interface PublicChama {
  id: string;
  name: string;
  description: string | null;
  ownerName: string;
  contributionKesMinor: string;
  frequency: string;
  customIntervalDays: number | null;
  settlementAsset: "BTC_SAT" | "USD_CENT";
  openSeats: number;
  totalSeats: number;
  myRequest: { id: string; status: string } | null;
}

/** Browse public chamas with free seats, read the goal, ask to join. The owner decides. */
export default function DiscoverPage() {
  const { t } = useApp();
  const q = useApi<{ chamas: PublicChama[] }>("/api/discover");
  const [openId, setOpenId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    setError(null);
    try {
      await fn();
      setOpenId(null);
      setMessage("");
      await q.refetch();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <Header title={t("discover.title")} />
      <Screen className="space-y-4">
        <p className="text-sm text-muted">{t("discover.subtitle")}</p>
        {q.error ? <ErrorState error={q.error} onRetry={q.refetch} /> : null}
        {!q.data && !q.error ? <Loading /> : null}
        {q.data && q.data.chamas.length === 0 ? (
          <Card className="space-y-3 text-center">
            <p className="text-sm text-muted">{t("discover.empty")}</p>
            <Link href="/join" className="text-sm font-semibold text-money underline-offset-4 hover:underline">
              {t("discover.haveCode")}
            </Link>
          </Card>
        ) : null}
        <ul className="space-y-3">
          {q.data?.chamas.map((c) => (
            <li key={c.id}>
              <Card as="article" className="space-y-3">
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-money text-lg font-extrabold text-white"
                    aria-hidden
                  >
                    {c.name[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-[16px] font-bold">{c.name}</h3>
                    <p className="text-xs text-muted">{t("discover.by", { name: c.ownerName })}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-warn-wash px-2.5 py-1 text-[11px] font-bold text-[#6b3b00]">
                    {t("discover.seats", { n: c.openSeats, total: c.totalSeats })}
                  </span>
                </div>
                <p className="text-sm leading-relaxed">{c.description || <span className="text-muted">{t("discover.noGoal")}</span>}</p>
                <p className="text-sm font-semibold text-forest">
                  {kes(c.contributionKesMinor)} · {frequencyLabel(t, c.frequency, c.customIntervalDays)} · {assetLabel(c.settlementAsset)}
                </p>

                {c.myRequest ? (
                  <div className="space-y-2">
                    <p className="rounded-xl bg-sage px-3 py-2 text-[13px] font-medium text-forest">{t("discover.pending")}</p>
                    <PillButton
                      variant="ghost"
                      busy={busy === c.id}
                      onClick={() => run(c.id, () => apiFetch(`/api/join-requests/${c.myRequest!.id}`, { method: "POST", body: { action: "cancel" } }))}
                    >
                      {t("discover.cancel")}
                    </PillButton>
                  </div>
                ) : openId === c.id ? (
                  <div className="space-y-2">
                    <textarea
                      rows={2}
                      maxLength={300}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder={t("discover.messagePh")}
                      className="w-full rounded-2xl border border-line bg-white px-3 py-2 text-sm"
                    />
                    <PillButton
                      busy={busy === c.id}
                      onClick={() =>
                        run(c.id, () => apiFetch(`/api/chamas/${c.id}/join-requests`, { method: "POST", body: { message: message || undefined } }))
                      }
                    >
                      {t("discover.send")}
                    </PillButton>
                  </div>
                ) : (
                  <PillButton
                    variant="secondary"
                    onClick={() => {
                      setOpenId(c.id);
                      setError(null);
                    }}
                  >
                    {t("discover.request")}
                  </PillButton>
                )}
              </Card>
            </li>
          ))}
        </ul>
        <InlineError message={error} />
        {q.data && q.data.chamas.length > 0 ? (
          <Link href="/join" className="block text-center text-sm font-semibold text-money underline-offset-4 hover:underline">
            {t("discover.haveCode")}
          </Link>
        ) : null}
      </Screen>
    </>
  );
}
