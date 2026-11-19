"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Dialog, Field, InlineError, MemberAvatar, PillButton, inputClass } from "@/components/ui";
import { useT } from "@/components/providers";
import { apiFetch } from "@/lib/client/api";
import { kes } from "@/lib/client/format";

interface Preview {
  groupId: string;
  groupName: string;
  contributionKesMinor: string;
  frequency: string;
  alreadyMember: boolean;
  seats: { memberId: string; name: string; position: number }[];
}

/** Enter invite code -> server validates -> pick your seat -> join -> Ledger. */
export function InviteFlow({ initialCode = "" }: { initialCode?: string }) {
  const t = useT();
  const router = useRouter();
  const [code, setCode] = useState(initialCode);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [seat, setSeat] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function check() {
    setBusy(true);
    setError(null);
    try {
      const p = await apiFetch<Preview>("/api/invites/preview", { method: "POST", body: { code } });
      setPreview(p);
      setSeat(p.seats.length === 1 ? p.seats[0].memberId : null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function join() {
    if (!preview) return;
    if (preview.alreadyMember) return router.push(`/chamas/${preview.groupId}`);
    setBusy(true);
    setError(null);
    try {
      const r = await apiFetch<{ groupId: string }>("/api/invites/accept", { method: "POST", body: { code, memberId: seat ?? undefined } });
      router.push(`/chamas/${r.groupId}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  if (!preview) {
    return (
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void check();
        }}
      >
        <Field label={t("invite.codeLabel")} htmlFor="invite-code">
          <input
            id="invite-code"
            className={`${inputClass} font-mono tracking-widest uppercase`}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="XXXX-XXXX-XX"
            autoCapitalize="characters"
            autoComplete="off"
            maxLength={40}
          />
        </Field>
        <InlineError message={error} />
        <PillButton type="submit" busy={busy} disabled={code.trim().length < 4}>
          {t("invite.check")}
        </PillButton>
      </form>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-sage p-4">
        <p className="text-lg font-bold">{preview.groupName}</p>
        <p className="text-sm text-muted">
          {kes(preview.contributionKesMinor)} · {preview.frequency.toLowerCase()}
        </p>
      </div>
      {preview.alreadyMember ? (
        <p>{t("invite.alreadyMember")}</p>
      ) : (
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-semibold">{t("invite.whichSeat")}</legend>
          {preview.seats.map((s) => (
            <label key={s.memberId} className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border px-3 ${seat === s.memberId ? "border-money bg-sage" : "border-line bg-white"}`}>
              <input type="radio" name="seat" value={s.memberId} checked={seat === s.memberId} onChange={() => setSeat(s.memberId)} className="h-5 w-5 accent-money" />
              <MemberAvatar name={s.name} size={32} />
              <span className="flex-1 font-semibold">{s.name}</span>
              <span className="text-xs text-muted">#{s.position}</span>
            </label>
          ))}
        </fieldset>
      )}
      <InlineError message={error} />
      <PillButton onClick={join} busy={busy} disabled={!preview.alreadyMember && !seat}>
        {preview.alreadyMember ? t("invite.open") : t("invite.join", { group: preview.groupName })}
      </PillButton>
    </div>
  );
}

export function InviteDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  return (
    <Dialog open={open} onClose={onClose} title={t("invite.title")}>
      {open ? <InviteFlow /> : null}
    </Dialog>
  );
}
