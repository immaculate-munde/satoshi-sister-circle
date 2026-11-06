
import { type Asset, formatFiat, formatUnits } from "../../lib/money";
import type { ReceiptSnapshot } from "../../lib/domain/receipts";

/** EAT rendering for receipts and ledger rows. Instants are stored in UTC. */
export function formatEat(iso: string, opts: { time?: boolean } = { time: true }): string {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
  if (opts.time === false) return date;
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Nairobi", hour: "2-digit", minute: "2-digit" }).format(d);
  return `${date}, ${time} EAT`;
}

export function shortHash(h: string | undefined, n = 8): string {
  if (!h) return "";
  return h.length <= n * 2 ? h : `${h.slice(0, n)}...${h.slice(-4)}`;
}

export interface TicketLine {
  label: string;
  value: string;
}

/** Fields shown on the ticket, derived only from the immutable snapshot. */
export function ticketLines(s: ReceiptSnapshot): TicketLine[] {
  const lines: TicketLine[] = [
    { label: "Receipt", value: s.receiptNumber },
    { label: "Chama", value: s.groupName },
    { label: "Round", value: String(s.roundNumber) },
  ];
  if (s.kind === "PAYOUT") {
    lines.push({ label: "Paid to", value: s.recipientName ?? "" });
    if (s.destinationLabel) lines.push({ label: "Wallet", value: s.destinationLabel });
  } else if (s.kind === "DIASPORA") {
    lines.push({ label: "Paid by", value: s.payerName });
    lines.push({ label: "On behalf of", value: s.beneficiaryName ?? "" });
    if (s.diaspora) {
      lines.push({
        label: "Sent",
        value: `${formatFiat(BigInt(s.diaspora.sourceMinor), "GBP", { cents: true })} (${s.diaspora.rateMode === "DEMO" ? "illustrative" : "quoted"} ${s.diaspora.rate} KES/GBP)`,
      });
    }
  } else {
    lines.push({ label: "Member", value: s.payerName });
  }
  lines.push({ label: "Amount", value: formatFiat(BigInt(s.totalKesMinor), "KES", { cents: true }) });
  lines.push({ label: "Settled", value: formatUnits(BigInt(s.principal.units), s.principal.asset as Asset) });
  lines.push({ label: "Rate", value: `${s.fx.rate} ${s.fx.pair.split("/")[1] === "BTC_SAT" ? "sats" : "US cents"}/KES (${s.fx.mode === "DEMO" ? "demo, illustrative" : "live"})` });
  lines.push({
    label: "Fee",
    value: `${formatUnits(BigInt(s.fee.units), s.fee.asset as Asset)}`,
  });
  lines.push({ label: "Status", value: s.status === "PAID_OUT" ? "Paid out" : "Settled" });
  lines.push({ label: "Date", value: formatEat(s.settledAt) });
  lines.push({ label: "Network", value: s.environment });
  lines.push({ label: "Proof", value: shortHash(s.paymentHash ?? s.providerProofRef.replace(/^.*:/, ""), 10) });
  return lines;
}
