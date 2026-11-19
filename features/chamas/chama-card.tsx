"use client";

import Link from "next/link";
import { useT } from "@/components/providers";
import { ProgressPot, StatusBadge } from "@/components/ui";
import { frequencyLabel, kes } from "@/lib/client/format";
import type { ChamaList } from "@/lib/client/types";
import { assetLabel } from "@/lib/money";

export function ChamaCard({ c }: { c: ChamaList["chamas"][number] }) {
  const t = useT();
  return (
    <Link
      href={`/chamas/${c.id}`}
      className="block overflow-hidden rounded-[var(--radius-card)] bg-white shadow-[var(--shadow-card)] transition-transform hover:-translate-y-0.5"
    >
      <div className="h-1.5 bg-pink" aria-hidden />
      <div className="flex items-start gap-3 p-4 pb-0">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-money text-lg font-extrabold text-white" aria-hidden>
          {c.name[0]}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[16px] font-bold">{c.name}</h3>
          <p className="text-[13px] text-muted">
            {t("common.members", { n: c.memberCount })} · {kes(c.contributionKesMinor)} {frequencyLabel(t, c.frequency)}
          </p>
        </div>
        {c.myStatus ? <StatusBadge status={c.myStatus} /> : null}
      </div>
      <div className="space-y-2 p-4">
        <ProgressPot paid={c.paidCount} total={c.totalCount} />
        <div className="flex justify-between text-[12px] text-muted">
          <span>
            {t("common.round", { n: c.round })} · {t("home.paidOf", { paid: c.paidCount, total: c.totalCount })}
          </span>
          <span>
            {t("home.nextPayout", { name: c.recipientName.split(" ")[0] })} · {assetLabel(c.settlementAsset)}
          </span>
        </div>
      </div>
    </Link>
  );
}
