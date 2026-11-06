"use client";

import { QRCodeSVG } from "qrcode.react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useApp } from "@/components/providers";
import { InlineError, Notice, PillButton } from "@/components/ui";
import { ApiError, apiFetch, useApi, useOnline } from "@/lib/client/api";
import { countdown, kes, units } from "@/lib/client/format";
import type { Invoice } from "@/lib/client/types";

/**
 * Shared QR/copy/expiry/payment-status UI for contributions and diaspora payments.
 * Navigates to success ONLY when the server reports the invoice PAID after checking the provider.
 */
export function InvoicePanel({ initial, onRegenerate }: { initial: Invoice; onRegenerate: () => Promise<void> }) {
  const { t, mode } = useApp();
  const router = useRouter();
  const online = useOnline();
  const live = useApi<Invoice>(`/api/invoices/${initial.id}`, { pollMs: 2000 });
  const inv = live.data ?? initial;
  const [now, setNow] = useState(() => Date.now());
  const [copied, setCopied] = useState(false);
  const [simBusy, setSimBusy] = useState(false);
  const [regenBusy, setRegenBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (inv.status === "PAID") router.replace(`/payments/${inv.id}/success`);
  }, [inv.status, inv.id, router]);

  const remaining = new Date(inv.expiresAt).getTime() - now;
  const expired = inv.status === "EXPIRED" || (inv.status === "PENDING" && remaining <= 0);
  const isDemo = inv.provider === "demo";
  const pr = inv.paymentRequest ?? "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(pr);
      setCopied(true);
      setTimeout(() => setCopied(false), 4000);
    } catch {
      setError("Couldn't access the clipboard. Long-press the invoice text to copy it.");
    }
  }

  async function simulate() {
    setSimBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/invoices/${inv.id}/pay`, { method: "POST" });
      await live.refetch();
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setSimBusy(false);
    }
  }

  async function regenerate() {
    setRegenBusy(true);
    setError(null);
    try {
      await onRegenerate();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRegenBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="relative mx-auto w-fit rounded-[24px] bg-white p-4 shadow-[var(--shadow-card)]">
        <div className={expired ? "opacity-20" : ""}>
          <QRCodeSVG value={pr || "pending"} size={220} level="M" marginSize={1} fgColor="#14201B" title={isDemo ? "Demo payment request (not a Lightning invoice)" : "Lightning invoice QR code"} />
        </div>
        {isDemo ? (
          <p className="absolute inset-x-3 bottom-2 rounded-lg bg-btc/95 px-2 py-1 text-center text-[10px] font-bold text-forest">{t("contribute.notQr")}</p>
        ) : null}
        {expired ? <p className="absolute inset-0 flex items-center justify-center text-center text-sm font-bold">Expired</p> : null}
      </div>

      <p className="text-center text-[12px] text-muted">{t("contribute.network", { network: inv.network })}</p>

      <div className="rounded-2xl bg-white p-3 shadow-[var(--shadow-card)]">
        <p className="mb-1 text-xs font-semibold text-muted">{t("contribute.scan")}</p>
        <p className="font-mono text-[11px] break-all text-ink/80 select-all" aria-label="Invoice text">
          {pr.length > 90 ? `${pr.slice(0, 44)}…${pr.slice(-24)}` : pr}
        </p>
      </div>

      <div role="status" aria-live="polite" className="text-center text-[14px] font-semibold">
        {inv.status === "CREATING" ? (
          t("common.loading")
        ) : expired ? (
          <span className="text-danger">{t("contribute.expired")}</span>
        ) : (
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 animate-pulse-soft rounded-full bg-btc" aria-hidden />
            {copied ? t("contribute.copied") : t("contribute.waiting")} · {t("contribute.expiresIn", { time: countdown(remaining) })}
          </span>
        )}
      </div>

      <InlineError message={error} />

      {expired ? (
        <PillButton onClick={regenerate} busy={regenBusy} disabled={!online}>
          {t("contribute.newInvoice")}
        </PillButton>
      ) : (
        <div className="space-y-2">
          {!isDemo ? (
            <a href={`lightning:${pr}`} className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-money px-6 text-[15px] font-semibold text-white">
              {t("contribute.openWallet")}
            </a>
          ) : null}
          <PillButton variant={isDemo ? "secondary" : "secondary"} onClick={copy} disabled={!pr}>
            {t("contribute.copy")}
          </PillButton>
          {mode.simulatedPayments && isDemo ? (
            <>
              <PillButton variant="orange" onClick={simulate} busy={simBusy} disabled={!online || !inv.paymentHash}>
                ⚡ {t("contribute.simulate")}
              </PillButton>
              <p className="text-center text-[11px] leading-snug text-muted">{t("contribute.simulateHint")}</p>
            </>
          ) : null}
          {!isDemo ? (
            <Notice>Paying from an in-app member wallet isn&apos;t available yet. Use any Lightning wallet: scan, open, or paste the invoice.</Notice>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function AmountSummary({ inv }: { inv: Invoice }) {
  return (
    <div className="text-center">
      <p className="text-[13px] text-muted">
        {inv.groupName} · Round {inv.round}
        {inv.kind === "DIASPORA" ? ` · for ${inv.memberName}` : ""}
      </p>
      <p className="mt-1 text-[36px] leading-none font-extrabold text-forest">{kes(inv.kesMinor)}</p>
      <p className="mt-1 text-[13px] text-muted">
        = {units(inv.amountUnits, inv.asset)} at {inv.quote.rate} {inv.asset === "BTC_SAT" ? "sats" : "¢"}/KES {inv.quote.mode === "DEMO" ? "(illustrative)" : ""}
      </p>
    </div>
  );
}
