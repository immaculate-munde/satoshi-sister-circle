"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useT } from "@/components/providers";
import { ErrorState, Header, InlineError, Loading, PillButton, Screen, StickyActions } from "@/components/ui";
import { ReceiptTicket } from "@/features/receipts/receipt-ticket";
import { useApi } from "@/lib/client/api";
import type { ReceiptView } from "@/lib/client/types";

/** 10 Receipt (Figma 5:378). Share/download first; success returns Home, cancel/failure stays here. */
export default function ReceiptPage() {
  const t = useT();
  const router = useRouter();
  const { receiptId } = useParams<{ receiptId: string }>();
  const r = useApi<ReceiptView>(`/api/receipts/${receiptId}`);
  const [busy, setBusy] = useState<"share" | "download" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (r.error && !r.data) return <ErrorState error={r.error} onRetry={r.refetch} />;
  if (!r.data) return <Loading />;
  const d = r.data;
  const pdfUrl = `/api/receipts/${receiptId}/pdf`;
  const backHref = d.kind === "PAYOUT" && d.payoutId ? `/chamas/${d.groupId}/payouts/${d.payoutId}` : `/chamas/${d.groupId}`;

  async function fetchPdf(): Promise<File> {
    const res = await fetch(pdfUrl, { credentials: "same-origin" });
    if (!res.ok) throw new Error("Couldn't generate the PDF. Please try again.");
    const blob = await res.blob();
    return new File([blob], `${d.receiptNumber}.pdf`, { type: "application/pdf" });
  }

  async function share() {
    setBusy("share");
    setError(null);
    try {
      const file = await fetchPdf();
      // Privacy-minimised: only the ticket PDF and a short line of text are shared.
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `Chama receipt ${d.receiptNumber}` });
        router.push("/home");
      } else {
        await download(file);
      }
    } catch (e) {
      setError((e as Error).name === "AbortError" ? t("receipt.shareFailed") : (e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function download(existing?: File) {
    setBusy("download");
    setError(null);
    try {
      const file = existing ?? (await fetchPdf());
      const url = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      router.push("/home");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <Header back={backHref} title={t("receipt.title")} />
      <Screen className="space-y-4 pt-2">
        <ReceiptTicket s={d.snapshot} contentHash={d.contentHash} />
        <p className={`text-center text-xs ${d.integrity === "VERIFIED" ? "text-money" : "text-danger"}`}>
          {t("receipt.integrity")}: {d.integrity === "VERIFIED" ? t("receipt.verified") : t("receipt.mismatch")}
        </p>
        <InlineError message={error} />
      </Screen>
      <StickyActions>
        <div className="no-print flex gap-3">
          <PillButton onClick={share} busy={busy === "share"} disabled={busy !== null}>
            {t("receipt.share")}
          </PillButton>
          <PillButton variant="secondary" onClick={() => download()} busy={busy === "download"} disabled={busy !== null}>
            {t("receipt.download")}
          </PillButton>
        </div>
      </StickyActions>
    </>
  );
}
