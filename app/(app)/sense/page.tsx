"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/components/providers";
import { PillButton, Screen } from "@/components/ui";
import { habitAmount, readStatement } from "@/lib/sense/read";
import { SAMPLE_ROOM_SMS, SAMPLE_THIN_SMS } from "@/lib/sense/samples";
import type { FinancialProfile } from "@/lib/sense/schema";

const STORE = "keyching.sense.v1";

type Saved = {
  profile: FinancialProfile;
  count: number;
  sample: "room" | "thin" | null;
};

function shillings(amount: number) {
  return `KES ${Math.round(amount).toLocaleString("en-KE")}`;
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

export default function SensePage() {
  const { t } = useApp();
  const [text, setText] = useState("");
  const [saved, setSaved] = useState<Saved | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) {
        const parsed = JSON.parse(raw) as Saved;
        if (parsed?.profile?.version === 1) setSaved(parsed);
      }
    } catch {
      /* a bad cache just means we start from the paste box */
    }
    setReady(true);
  }, []);

  function keep(next: Saved | null) {
    setSaved(next);
    if (!next) localStorage.removeItem(STORE);
    else localStorage.setItem(STORE, JSON.stringify(next));
  }

  function analyze(source: string, sample: Saved["sample"]) {
    setError(null);
    try {
      const result = readStatement(source);
      keep({ profile: result.profile, count: result.count, sample });
      setText("");
    } catch {
      setError(t("sense.unreadable"));
    }
  }

  if (!ready) return null;

  if (!saved) {
    return (
      <Screen className="pt-4">
        <h1 className="text-[28px] font-extrabold">{t("sense.title")}</h1>
        <p className="mt-2 text-[14px] leading-6 text-muted">{t("sense.lead")}</p>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={t("sense.placeholder")}
          aria-label={t("sense.placeholder")}
          className="mt-5 min-h-44 w-full rounded-2xl border border-line bg-white px-4 py-3 text-[14px] leading-6 text-ink outline-none placeholder:text-muted/70 focus:border-money"
        />
        {error ? <p className="mt-3 text-sm font-semibold text-danger">{error}</p> : null}
        <div className="mt-4 space-y-2">
          <PillButton disabled={!text.trim()} onClick={() => analyze(text, null)}>
            {t("sense.read")}
          </PillButton>
          <PillButton variant="secondary" onClick={() => analyze(SAMPLE_ROOM_SMS, "room")}>
            {t("sense.sampleRoom")}
          </PillButton>
          <PillButton variant="secondary" onClick={() => analyze(SAMPLE_THIN_SMS, "thin")}>
            {t("sense.sampleThin")}
          </PillButton>
        </div>
        <p className="mt-4 text-[12px] leading-5 text-muted">{t("sense.privacy")}</p>
      </Screen>
    );
  }

  const { profile, count, sample } = saved;
  const surplus = profile.surplus.monthlyKes;
  const habit = habitAmount(profile);
  const incomeNames = profile.income.sources
    .slice(0, 2)
    .map((source) => titleCase(source.value.label))
    .join(", ");
  const spendNames = profile.spending.byCategory
    .slice(0, 2)
    .map((row) => titleCase(row.category))
    .join(", ");
  const storyKey =
    !incomeNames && !spendNames
      ? "sense.storySparse"
      : profile.income.sources.some((source) => source.value.kind === "business")
        ? "sense.storyBusiness"
        : incomeNames
          ? "sense.storySalary"
          : "sense.storyMixed";

  return (
    <Screen className="pt-4">
      <h1 className="text-[28px] font-extrabold">{t("sense.title")}</h1>
      <div className="relative mt-5 overflow-hidden rounded-[28px] bg-forest p-5 text-white shadow-[var(--shadow-card)]">
        <div className="absolute -top-8 -right-6 h-28 w-28 rounded-full bg-pink/35" aria-hidden />
        <div className="absolute -bottom-10 left-8 h-24 w-24 rounded-full bg-btc/25" aria-hidden />
        <div className="relative">
          <p className="text-[13px] font-medium text-cream/80">
            {t("sense.moves", { n: count, months: profile.window.monthsCovered })}
          </p>
          {sample ? <p className="mt-2 text-[12px] font-semibold text-pink">{t("sense.demo")}</p> : null}
          <p className="mt-4 text-[13px] text-cream/75">{t("sense.floorLabel")}</p>
          <p className="mt-1 text-[34px] leading-none font-extrabold">{shillings(surplus.floor)}</p>
          <p className="mt-2 text-[13px] text-cream/80">
            {t("sense.typical", { amount: shillings(surplus.typical) })}
            {" · "}
            {t("sense.ceiling", { amount: shillings(surplus.ceiling) })}
          </p>
          <p className="mt-3 text-[12px] font-semibold text-pink">
            {profile.window.from} – {profile.window.to}
          </p>
        </div>
      </div>

      <p className="mt-4 rounded-[20px] bg-white px-4 py-4 text-[14px] leading-6 text-ink shadow-[var(--shadow-card)]">
        {t(storyKey, { income: incomeNames || "—", spend: spendNames || "—" })}
      </p>

      <p className={`mt-3 rounded-[20px] px-4 py-4 text-[14px] leading-6 ${habit ? "bg-sage text-forest" : "bg-forest text-white"}`}>
        {habit ? t("sense.habit", { amount: shillings(habit) }) : t("sense.buffer")}
      </p>

      <Section title={t("sense.income")}>
        {profile.income.sources.slice(0, 4).map((source) => (
          <Row
            key={source.value.label}
            label={titleCase(source.value.label)}
            value={`${shillings(source.value.monthlyKes.floor)} – ${shillings(source.value.monthlyKes.ceiling)}`}
          />
        ))}
      </Section>

      <Section title={t("sense.commitments")}>
        {profile.commitments.slice(0, 5).map((row) => (
          <Row key={`${row.category}-${row.label}`} label={titleCase(row.label)} value={shillings(row.amountKes)} />
        ))}
      </Section>

      <Section title={t("sense.spending")}>
        {profile.spending.byCategory.slice(0, 4).map((row) => (
          <Row key={row.category} label={titleCase(row.category)} value={shillings(row.monthlyKes.typical)} />
        ))}
      </Section>

      {profile.resilience.fulizaObservations > 0 ? (
        <p className="mt-3 text-[13px] text-muted">{t("sense.fuliza", { n: profile.resilience.fulizaObservations })}</p>
      ) : null}

      <div className="mt-5">
        <PillButton
          variant="secondary"
          onClick={() => {
            keep(null);
            setError(null);
          }}
        >
          {t("sense.another")}
        </PillButton>
      </div>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-4 rounded-[20px] bg-white px-4 py-3 shadow-[var(--shadow-card)]">
      <h2 className="text-[15px] font-bold text-forest">{title}</h2>
      <ul className="mt-2 divide-y divide-line">{children}</ul>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-baseline justify-between gap-3 py-2.5 text-[14px]">
      <span className="min-w-0 truncate text-ink">{label}</span>
      <span className="shrink-0 font-semibold text-forest">{value}</span>
    </li>
  );
}
