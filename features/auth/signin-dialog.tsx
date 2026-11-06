"use client";

import { useState } from "react";
import { MemberAvatar, Dialog, Field, InlineError, PillButton, inputClass } from "@/components/ui";
import { useApp } from "@/components/providers";
import { apiFetch, useApi } from "@/lib/client/api";

interface Persona {
  id: string;
  displayName: string;
}

export function SignInDialog({ open, onClose, onSignedIn }: { open: boolean; onClose: () => void; onSignedIn: () => void }) {
  const { t, mode } = useApp();
  const { data } = useApi<{ personas: Persona[] }>(open ? "/api/auth/personas" : null);
  const [name, setName] = useState("");
  const [passcode, setPasscode] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function signIn(body: object, key: string) {
    setBusy(key);
    setError(null);
    try {
      await apiFetch("/api/auth/signin", { method: "POST", body });
      onSignedIn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={t("signin.title")}>
      <div className="space-y-5">
        {mode.provider === "demo" && data?.personas.length ? (
          <div className="space-y-2">
            <p className="text-sm text-muted">{t("signin.demoHint")}</p>
            <ul className="space-y-2">
              {data.personas.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => signIn({ personaId: p.id }, p.id)}
                    disabled={busy !== null}
                    className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-line bg-white px-3 text-left hover:border-money disabled:opacity-60"
                  >
                    <MemberAvatar name={p.displayName} />
                    <span className="flex-1 font-semibold">{p.displayName}</span>
                    {busy === p.id ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-money border-t-transparent" aria-hidden /> : null}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) void signIn({ displayName: name.trim(), passcode: passcode || undefined }, "new");
          }}
        >
          <Field label={t("signin.newName")} htmlFor="signin-name">
            <input id="signin-name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder={t("signin.namePlaceholder")} maxLength={40} autoComplete="name" />
          </Field>
          {mode.provider !== "demo" ? (
            <Field label={t("signin.passcode")} htmlFor="signin-pass">
              <input id="signin-pass" type="password" className={inputClass} value={passcode} onChange={(e) => setPasscode(e.target.value)} autoComplete="current-password" />
            </Field>
          ) : null}
          <InlineError message={error} />
          <PillButton type="submit" busy={busy === "new"} disabled={!name.trim() || busy !== null}>
            {t("signin.submit")}
          </PillButton>
        </form>
      </div>
    </Dialog>
  );
}
