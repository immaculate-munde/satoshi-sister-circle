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
  const demo = mode.provider === "demo";
  const { data } = useApi<{ personas: Persona[] }>(open && demo ? "/api/auth/personas" : null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [passcode, setPasscode] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [isNew, setIsNew] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const signInDemo = (body: object, key: string) =>
    run(key, async () => {
      await apiFetch("/api/auth/signin", { method: "POST", body });
      onSignedIn();
    });

  const requestCode = () =>
    run("request", async () => {
      const res = await apiFetch<{ ok: boolean; isNew: boolean }>("/api/auth/otp/request", {
        method: "POST",
        body: { phone, passcode: passcode || undefined },
      });
      setIsNew(res.isNew);
      setStep("code");
    });

  const verify = () =>
    run("verify", async () => {
      await apiFetch("/api/auth/otp/verify", { method: "POST", body: { phone, code, displayName: isNew ? name.trim() : undefined } });
      onSignedIn();
    });

  return (
    <Dialog open={open} onClose={onClose} title={t("signin.title")}>
      <div className="space-y-5">
        {demo && data?.personas.length ? (
          <div className="space-y-2">
            <p className="text-sm text-muted">{t("signin.demoHint")}</p>
            <ul className="space-y-2">
              {data.personas.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => signInDemo({ personaId: p.id }, p.id)}
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

        {demo ? (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) void signInDemo({ displayName: name.trim() }, "new");
            }}
          >
            <Field label={t("signin.newName")} htmlFor="signin-name">
              <input id="signin-name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder={t("signin.namePlaceholder")} maxLength={40} autoComplete="name" />
            </Field>
            <InlineError message={error} />
            <PillButton type="submit" busy={busy === "new"} disabled={!name.trim() || busy !== null}>
              {t("signin.submit")}
            </PillButton>
          </form>
        ) : step === "phone" ? (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (phone.trim() && passcode) void requestCode();
            }}
          >
            <Field label={t("signin.phone")} htmlFor="signin-phone" hint={t("signin.phoneHint")}>
              <input id="signin-phone" type="tel" inputMode="tel" className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0712 345 678" autoComplete="tel" />
            </Field>
            <Field label={t("signin.passcode")} htmlFor="signin-pass">
              <input id="signin-pass" type="password" className={inputClass} value={passcode} onChange={(e) => setPasscode(e.target.value)} autoComplete="off" />
            </Field>
            <InlineError message={error} />
            <PillButton type="submit" busy={busy === "request"} disabled={!phone.trim() || !passcode || busy !== null}>
              {t("signin.sendCode")}
            </PillButton>
          </form>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (code.length === 6 && (!isNew || name.trim())) void verify();
            }}
          >
            <p className="text-sm text-muted">{t("signin.codeSent", { phone: phone.trim() })}</p>
            <Field label={t("signin.code")} htmlFor="signin-code">
              <input
                id="signin-code"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                className={`${inputClass} tracking-[0.4em]`}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                autoComplete="one-time-code"
                autoFocus
              />
            </Field>
            {isNew ? (
              <Field label={t("signin.yourName")} htmlFor="signin-name2">
                <input id="signin-name2" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoComplete="name" />
              </Field>
            ) : null}
            <InlineError message={error} />
            <PillButton type="submit" busy={busy === "verify"} disabled={code.length !== 6 || (isNew && !name.trim()) || busy !== null}>
              {t("signin.verify")}
            </PillButton>
            <button
              type="button"
              className="min-h-11 w-full text-sm font-semibold text-money"
              onClick={() => {
                setStep("phone");
                setCode("");
                setError(null);
              }}
            >
              {t("signin.changeNumber")}
            </button>
          </form>
        )}
      </div>
    </Dialog>
  );
}
