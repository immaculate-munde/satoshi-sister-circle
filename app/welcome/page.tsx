"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { CircleArt } from "@/components/art";
import { useT } from "@/components/providers";
import { PillButton, Screen, StickyActions } from "@/components/ui";
import { SignInDialog } from "@/features/auth/signin-dialog";
import { InviteDialog } from "@/features/chamas/invite-dialog";
import { apiFetch } from "@/lib/client/api";

/** 02 Welcome (Figma 2:19). */
function Welcome() {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/home";
  const [signInOpen, setSignInOpen] = useState(params.get("signin") === "1");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [after, setAfter] = useState<"home" | "invite">("home");
  const [busy, setBusy] = useState(false);

  async function start(target: "home" | "invite") {
    setBusy(true);
    try {
      const me = await apiFetch<{ user: { id: string } | null }>("/api/me");
      if (me.user) {
        if (target === "home") router.push(safeNext);
        else setInviteOpen(true);
        return;
      }
      setAfter(target);
      setSignInOpen(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Screen className="pt-6">
        <div className="flex justify-center">
          <CircleArt className="w-56 animate-fade-up" />
        </div>
        <h1 className="mt-6 text-[30px] leading-tight font-extrabold tracking-tight text-forest">{t("welcome.title")}</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink/85">{t("welcome.body")}</p>
        <p className="mt-4 rounded-2xl bg-sage px-4 py-3 text-[13px] leading-snug text-forest">{t("welcome.custody")}</p>
      </Screen>
      <StickyActions>
        <PillButton onClick={() => start("home")} busy={busy && after === "home"}>
          {t("welcome.getStarted")}
        </PillButton>
        <PillButton variant="secondary" onClick={() => start("invite")}>
          {t("welcome.haveInvite")}
        </PillButton>
      </StickyActions>
      <SignInDialog
        open={signInOpen}
        onClose={() => setSignInOpen(false)}
        onSignedIn={() => {
          setSignInOpen(false);
          if (after === "invite") setInviteOpen(true);
          else router.push(safeNext);
        }}
      />
      <InviteDialog open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </>
  );
}

export default function WelcomePage() {
  return (
    <Suspense>
      <Welcome />
    </Suspense>
  );
}
