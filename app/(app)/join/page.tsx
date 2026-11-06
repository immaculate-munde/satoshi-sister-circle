"use client";

import { InviteFlow } from "@/features/chamas/invite-dialog";
import { useT } from "@/components/providers";
import { Header, Screen } from "@/components/ui";

export default function JoinPage() {
  const t = useT();
  return (
    <>
      <Header title={t("invite.title")} back="/home" />
      <Screen>
        <InviteFlow />
      </Screen>
    </>
  );
}
