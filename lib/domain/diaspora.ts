import { many, one } from "../db";
import { bps, convertFiatMinor, divRoundHalfUp, parseDecimal } from "../money";
import { displayStatus, requireMember } from "./chamas";
import { type Ctx, DomainError } from "./context";
import { DEMO_FX_SOURCE, DEMO_RATES } from "./fx";
import { requestInvoice } from "./invoices";
import { REMITTANCE_BENCHMARK } from "./receipts";
import type { ContributionRow, CycleRow, MemberRow } from "./rows";

/** GBP minor needed to cover a KES obligation at the (demo) GBP/KES rate. */
export function gbpMinorForKes(kesMinor: bigint, gbpKesRate: string = DEMO_RATES.GBP_KES): bigint {
  const r = parseDecimal(gbpKesRate);
  let gbp = divRoundHalfUp(kesMinor * 10n ** BigInt(r.scale), r.num);
  // Never under-cover the obligation because of rounding.
  while (convertFiatMinor(gbp, gbpKesRate) + 100n < kesMinor) gbp += 1n;
  return gbp;
}

export function feeComparison(gbpMinor: bigint) {
  return {
    traditional: {
      lowMinor: bps(gbpMinor, REMITTANCE_BENCHMARK.lowBps).toString(),
      highMinor: bps(gbpMinor, REMITTANCE_BENCHMARK.highBps).toString(),
      scope: REMITTANCE_BENCHMARK.scope,
    },
    lightning: {
      // The chama is charged nothing to receive. We have not measured the payer's wallet, GBP on-ramp,
      // FX spread or any KES off-ramp, so we do not claim an end-to-end saving.
      networkFeeMinor: "0",
      scope: "Lightning network fee only (measured: none charged to receive). Payer wallet, GBP on-ramp and FX costs may apply.",
      endToEndMeasured: false,
    },
  };
}

export function getDiasporaContext(ctx: Ctx, groupId: string, userId: string) {
  const { group } = requireMember(ctx.db, groupId, userId);
  const cycle = one<CycleRow>(ctx.db, "SELECT * FROM cycles WHERE group_id = :g ORDER BY round_number DESC LIMIT 1", { g: groupId })!;
  const members = new Map(
    many<MemberRow>(ctx.db, "SELECT * FROM members WHERE group_id = :g", { g: groupId }).map((m) => [m.id, m]),
  );
  const now = ctx.now();
  const obligations = many<ContributionRow>(ctx.db, "SELECT * FROM contributions WHERE cycle_id = :c", { c: cycle.id })
    .map((c) => ({
      contributionId: c.id,
      memberId: c.member_id,
      name: members.get(c.member_id)!.display_name,
      position: members.get(c.member_id)!.rotation_position,
      status: displayStatus(c, cycle, now),
      dueKesMinor: String(c.due_kes_minor),
      payerLabel: c.payer_label,
    }))
    .sort((a, b) => a.position - b.position);
  const kes = BigInt(group.contribution_kes_minor);
  const gbp = gbpMinorForKes(kes);
  return {
    groupId,
    groupName: group.name,
    round: cycle.round_number,
    roundOpen: cycle.status === "OPEN",
    settlementAsset: group.settlement_asset,
    obligations,
    quote: { gbpMinor: gbp.toString(), kesMinor: kes.toString(), rate: DEMO_RATES.GBP_KES, mode: "DEMO", source: DEMO_FX_SOURCE },
    comparison: feeComparison(gbp),
    unavailableLegs: [
      "No GBP card or bank on-ramp is integrated: Njeri pays the Lightning invoice from her own wallet.",
      "No M-Pesa or KES bank cash-out: the recipient receives Bitcoin or Flash USD-stable value.",
      "GBP/KES rate is an illustrative demo rate, not a live quote.",
    ],
  };
}

export async function createDiasporaInvoice(ctx: Ctx, input: { userId: string; groupId: string; memberId: string; payerName: string; payerCity: string }) {
  const payerName = input.payerName.trim();
  const payerCity = input.payerCity.trim();
  if (payerName.length < 1 || payerName.length > 40) throw new DomainError("INVALID_PAYER", "Enter the payer's name");
  if (payerCity.length > 40) throw new DomainError("INVALID_PAYER", "City is too long");
  const { group } = requireMember(ctx.db, input.groupId, input.userId);
  const gbp = gbpMinorForKes(BigInt(group.contribution_kes_minor));
  return requestInvoice(ctx, {
    userId: input.userId,
    groupId: input.groupId,
    memberId: input.memberId,
    kind: "DIASPORA",
    payerLabel: payerCity ? `${payerName} (${payerCity})` : payerName,
    diaspora: { sourceMinor: gbp, sourceCurrency: "GBP" },
  });
}
