"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/components/providers";
import { ErrorState, Header, Loading, PillLink, Screen } from "@/components/ui";
import { AmountSummary, InvoicePanel } from "@/features/payments/invoice-panel";
import { type ApiError, apiFetch, newIdempotencyKey } from "@/lib/client/api";
import { kes } from "@/lib/client/format";
import type { Invoice } from "@/lib/client/types";

/** 06 Contribute - Lightning QR (Figma 5:2). The server decides amount and asset. */
export default function ContributePage() {
  const t = useT();
  const { groupId } = useParams<{ groupId: string }>();
  const [inv, setInv] = useState<Invoice | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const started = useRef(false);

  const load = useCallback(
    async (forceNew = false) => {
      setError(null);
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          const r = await apiFetch<Invoice>(`/api/chamas/${groupId}/invoices`, {
            method: "POST",
            body: { forceNew },
            idempotencyKey: newIdempotencyKey(),
          });
          setInv(r);
          return;
        } catch (e) {
          const err = e as ApiError;
          if (err.code === "INVOICE_CREATING") {
            await new Promise((res) => setTimeout(res, 1000));
            continue;
          }
          setError(err);
          return;
        }
      }
    },
    [groupId],
  );

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void load();
  }, [load]);

  const chips = ["250000", "500000", "750000"];

  return (
    <>
      <Header back={`/chamas/${groupId}`} title={t("contribute.title")} />
      <Screen className="space-y-5">
        {error ? (
          error.code === "ALREADY_PAID" || error.code === "NO_OPEN_ROUND" ? (
            <div className="space-y-4 py-10 text-center">
              <p className="text-[16px] font-semibold">{error.code === "ALREADY_PAID" ? t("contribute.alreadyPaid") : error.message}</p>
              <PillLink href={`/chamas/${groupId}`}>{t("success.back")}</PillLink>
            </div>
          ) : (
            <ErrorState error={error} onRetry={() => load()} />
          )
        ) : !inv ? (
          <Loading />
        ) : (
          <>
            <AmountSummary inv={inv} />
            <div role="group" aria-label="Amount" className="flex justify-center gap-2">
              {chips.map((c) => {
                const selected = c === inv.kesMinor;
                return (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={selected}
                    disabled={!selected}
                    title={selected ? t("contribute.fixed") : t("contribute.unavailable", { amount: kes(inv.kesMinor) })}
                    className={`min-h-11 rounded-full px-4 text-sm font-semibold ${selected ? "bg-money text-white" : "bg-white text-muted line-through decoration-muted/60 border border-line"}`}
                  >
                    {kes(c)}
                  </button>
                );
              })}
            </div>
            <p className="-mt-3 text-center text-[11px] text-muted">{t("contribute.fixed")}</p>
            <InvoicePanel initial={inv} onRegenerate={() => load(true)} />
            <p className="text-center text-xs text-muted">
              <Link href={`/chamas/${groupId}`} className="underline">
                {t("success.back")}
              </Link>
            </p>
          </>
        )}
      </Screen>
    </>
  );
}
