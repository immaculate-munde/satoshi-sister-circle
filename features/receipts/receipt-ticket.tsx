"use client";

import { ReceiptArt } from "@/components/art";
import type { ReceiptSnapshot } from "@/lib/domain/receipts";
import { formatFiat } from "@/lib/money";
import { ticketLines } from "./format";

const scallop = (dir: "x" | "y") =>
  ({
    background: `radial-gradient(circle, var(--color-paper) 6.5px, transparent 7px) 0 0 / ${dir === "y" ? "14px 22px" : "22px 14px"} ${dir === "y" ? "repeat-y" : "repeat-x"}`,
  }) as const;

/** 10 Receipt ticket (Figma 5:378): deep-forest scalloped stamp with cream artwork. Every field comes from the snapshot. */
export function ReceiptTicket({ s, contentHash }: { s: ReceiptSnapshot; contentHash: string }) {
  const kindLabel = s.kind === "PAYOUT" ? "Automatic payout receipt" : s.kind === "DIASPORA" ? "Diaspora contribution receipt" : "Contribution receipt";
  return (
    <article aria-label={`${kindLabel} ${s.receiptNumber}`} className="relative mx-2 bg-forest px-6 pt-7 pb-8 text-cream">
      <span aria-hidden className="absolute top-0 bottom-0 -left-[7px] w-[14px]" style={scallop("y")} />
      <span aria-hidden className="absolute top-0 -right-[7px] bottom-0 w-[14px]" style={scallop("y")} />
      <span aria-hidden className="absolute -top-[7px] right-0 left-0 h-[14px]" style={scallop("x")} />
      <span aria-hidden className="absolute right-0 -bottom-[7px] left-0 h-[14px]" style={scallop("x")} />

      <p className="mx-auto w-fit rounded-full bg-btc px-3 py-1 text-[10px] font-extrabold tracking-wide text-forest">
        {s.mode === "DEMO" ? "DEMO · SIMULATED, NO REAL FUNDS" : s.mode === "FLASH_LIVE" ? "LIVE PILOT · REAL FUNDS" : "FLASH TEST NETWORK · TEST FUNDS"}
      </p>
      <ReceiptArt className="mx-auto mt-3 w-[85%]" />
      <p className="mt-2 text-center text-[30px] font-extrabold italic">asante sana!</p>
      <p className="text-center text-[13px] text-cream/80">{kindLabel}</p>

      <div className="my-4 border-t-2 border-dashed border-cream/40" />
      <dl className="space-y-2 text-[13px]">
        {ticketLines(s).map((l) => (
          <div key={l.label} className="flex items-start justify-between gap-4">
            <dt className="text-cream/70">{l.label}</dt>
            <dd className="text-right font-semibold break-all">{l.value}</dd>
          </div>
        ))}
      </dl>
      <div className="my-4 border-t-2 border-dashed border-cream/40" />
      <p className="text-center text-[28px] font-extrabold text-btc">TOTAL: {formatFiat(BigInt(s.totalKesMinor), "KES")}</p>
      {s.diaspora ? (
        <p className="mt-3 text-[11px] leading-snug text-cream/80">
          Historical UK–Kenya remittance cost on this amount: {formatFiat(BigInt(s.diaspora.benchmark.lowMinor), "GBP", { cents: true })} to{" "}
          {formatFiat(BigInt(s.diaspora.benchmark.highMinor), "GBP", { cents: true })} (3.4%–4.4%, World Bank 2025). Not a live quote.
        </p>
      ) : null}
      <p className="mt-3 text-[10px] leading-snug text-cream/60">
        {s.fee.note} Integrity {contentHash.slice(0, 16)}… KES amounts are display values; settlement is in{" "}
        {s.principal.asset === "BTC_SAT" ? "sats" : "Flash USD-stable cents"}.
      </p>
    </article>
  );
}
