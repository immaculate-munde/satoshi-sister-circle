import { AppShell } from "@/components/app-shell";

/** Signed-in app chrome: desktop sidebar + mobile bottom nav. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
