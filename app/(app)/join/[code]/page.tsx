"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useT } from "@/components/providers";
import { Header, Loading, Screen } from "@/components/ui";
import { InviteFlow } from "@/features/chamas/invite-dialog";
import { apiFetch } from "@/lib/client/api";

/** Invite deep link: /join/ABCD-EFGH-JK -> sign in if needed -> choose seat -> Ledger. */
export default function JoinPage() {
  const t = useT();
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    apiFetch<{ user: unknown }>("/api/me").then((me) => {
      if (!me.user) router.replace(`/welcome?signin=1&next=${encodeURIComponent(`/join/${code}`)}`);
      else setReady(true);
    });
  }, [code, router]);
  return (
    <>
      <Header back="/welcome" title={t("invite.title")} />
      <Screen>{ready ? <InviteFlow initialCode={decodeURIComponent(code)} /> : <Loading />}</Screen>
    </>
  );
}
