"use client";

import { useState } from "react";
import { useApp } from "@/components/providers";
import { Card, InlineError, MemberAvatar, PillButton } from "@/components/ui";
import { apiFetch, useApi } from "@/lib/client/api";

interface RequestsView {
  visibility: "PRIVATE" | "PUBLIC";
  description: string | null;
  requests: { id: string; name: string; message: string | null; createdAt: string }[];
  openSeats: { memberId: string; name: string; position: number; wallet: string | null }[];
}

/** Owner-only: who is visible in Discover, and who is asking to join. */
export function JoinRequestsPanel({ groupId }: { groupId: string }) {
  const { t } = useApp();
  const q = useApi<RequestsView>(`/api/chamas/${groupId}/join-requests`);
  const [seatFor, setSeatFor] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [goal, setGoal] = useState<string | null>(null);

  const d = q.data;
  if (!d) return null;
  const goalValue = goal ?? d.description ?? "";

  async function act(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    setError(null);
    try {
      await fn();
      setGoal(null);
      await q.refetch();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const decide = (requestId: string, action: "approve" | "reject") =>
    act(requestId + action, () =>
      apiFetch(`/api/join-requests/${requestId}`, {
        method: "POST",
        body: { action, memberId: action === "approve" ? seatFor[requestId] || undefined : undefined },
      }),
    );

  const save = (visibility: "PRIVATE" | "PUBLIC") =>
    act("vis", () =>
      apiFetch(`/api/chamas/${groupId}/visibility`, { method: "POST", body: { visibility, description: goalValue || undefined } }),
    );

  return (
    <section aria-labelledby="req-h">
      <h2 id="req-h" className="mb-2 text-[16px] font-bold">
        {t("requests.title")}
      </h2>
      <Card className="space-y-4">
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">{t("requests.visible")}</legend>
          <div className="flex flex-col gap-2 sm:flex-row">
            {(["PRIVATE", "PUBLIC"] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={d.visibility === v}
                disabled={busy !== null}
                onClick={() => d.visibility !== v && save(v)}
                className={`min-h-11 flex-1 rounded-2xl border px-3 text-left text-sm font-semibold ${
                  d.visibility === v ? "border-money bg-sage text-forest" : "border-line bg-white text-ink"
                }`}
              >
                {v === "PRIVATE" ? t("requests.private") : t("requests.public")}
              </button>
            ))}
          </div>
          {d.visibility === "PUBLIC" ? (
            <div className="space-y-2 pt-1">
              <textarea
                rows={2}
                maxLength={500}
                value={goalValue}
                onChange={(e) => setGoal(e.target.value)}
                placeholder={t("create.goalPh")}
                aria-label={t("create.goal")}
                className="w-full rounded-2xl border border-line bg-white px-3 py-2 text-sm"
              />
              {goal !== null && goal !== (d.description ?? "") ? (
                <PillButton variant="secondary" busy={busy === "vis"} onClick={() => save("PUBLIC")}>
                  {t("requests.save")}
                </PillButton>
              ) : null}
            </div>
          ) : null}
        </fieldset>

        {d.requests.length === 0 ? (
          <p className="text-sm text-muted">{t("requests.none")}</p>
        ) : (
          <ul className="space-y-3">
            {d.requests.map((r) => (
              <li key={r.id} className="space-y-2 rounded-2xl border border-line p-3">
                <div className="flex items-center gap-3">
                  <MemberAvatar name={r.name} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{r.name}</p>
                    {r.message ? <p className="text-sm text-muted">{r.message}</p> : null}
                  </div>
                </div>
                {d.openSeats.length > 1 ? (
                  <label className="block text-xs font-semibold text-muted">
                    {t("requests.seat")}
                    <select
                      className="mt-1 min-h-11 w-full rounded-xl border border-line bg-white px-2 text-sm text-ink"
                      value={seatFor[r.id] ?? ""}
                      onChange={(e) => setSeatFor((s) => ({ ...s, [r.id]: e.target.value }))}
                    >
                      <option value="">
                        #{d.openSeats[0].position} {d.openSeats[0].name}
                      </option>
                      {d.openSeats.slice(1).map((s) => (
                        <option key={s.memberId} value={s.memberId}>
                          #{s.position} {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <p className="text-xs text-muted">{t("requests.seatNote")}</p>
                <div className="flex gap-2">
                  <PillButton busy={busy === r.id + "approve"} disabled={busy !== null} onClick={() => decide(r.id, "approve")}>
                    {t("requests.approve")}
                  </PillButton>
                  <PillButton variant="ghost" busy={busy === r.id + "reject"} disabled={busy !== null} onClick={() => decide(r.id, "reject")}>
                    {t("requests.reject")}
                  </PillButton>
                </div>
              </li>
            ))}
          </ul>
        )}
        <InlineError message={error} />
      </Card>
    </section>
  );
}
