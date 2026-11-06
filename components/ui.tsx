"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ButtonHTMLAttributes, type ReactNode, useEffect, useId, useRef } from "react";
import { useApp, useT } from "./providers";
import { useOnline } from "@/lib/client/api";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "orange";

const variants: Record<Variant, string> = {
  primary: "bg-money text-white hover:bg-forest disabled:bg-muted/40",
  secondary: "bg-white text-money border border-money/30 hover:bg-sage disabled:text-muted",
  ghost: "bg-transparent text-money hover:bg-sage",
  danger: "bg-danger text-white hover:opacity-90",
  orange: "bg-btc text-forest hover:bg-warm",
};

export function PillButton({
  variant = "primary",
  className = "",
  busy,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; busy?: boolean }) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || busy}
      aria-busy={busy || undefined}
      className={`inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-6 text-[15px] font-semibold transition-colors disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    >
      {busy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden /> : null}
      {children}
    </button>
  );
}

export function PillLink({ href, variant = "primary", children, className = "" }: { href: string; variant?: Variant; children: ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      className={`inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-6 text-[15px] font-semibold transition-colors ${variants[variant]} ${className}`}
    >
      {children}
    </Link>
  );
}

export function Card({ children, className = "", as: As = "section" }: { children: ReactNode; className?: string; as?: "section" | "div" | "article" }) {
  // Only default to white when the caller didn't choose a background (both classes would conflict).
  const bg = /(^|\s)bg-/.test(className) ? "" : "bg-white";
  return <As className={`rounded-[var(--radius-card)] p-4 shadow-[var(--shadow-card)] ${bg} ${className}`}>{children}</As>;
}

const AVATAR_COLORS = ["#0F6B4C", "#FF9F1C", "#0A3D2E", "#F7931A", "#5C6B64", "#2E8B6A"];

export function MemberAvatar({ name, size = 40, ring }: { name: string; size?: number; ring?: boolean }) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const color = AVATAR_COLORS[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length];
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white ${ring ? "ring-2 ring-white" : ""}`}
      style={{ width: size, height: size, background: color, fontSize: size * 0.36 }}
    >
      {initials}
    </span>
  );
}

export function StatusBadge({ status }: { status: "PAID" | "PENDING" | "LATE" }) {
  const t = useT();
  const styles = {
    PAID: "bg-sage text-money",
    PENDING: "bg-warn-wash text-[#8a4b00]",
    LATE: "bg-danger-wash text-danger",
  }[status];
  const label = status === "PAID" ? t("common.paid") : status === "LATE" ? t("common.late") : t("common.pending");
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${styles}`}>
      <span aria-hidden>{status === "PAID" ? "✓" : status === "LATE" ? "!" : "•"}</span>
      {label}
    </span>
  );
}

export function ProgressPot({ paid, total, label, onDark }: { paid: number; total: number; label?: string; onDark?: boolean }) {
  const pct = total ? Math.round((paid / total) * 100) : 0;
  return (
    <div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={paid}
        aria-label={label ?? `${paid} of ${total} paid`}
        className={`h-3 w-full overflow-hidden rounded-full ${onDark ? "bg-white/15" : "bg-sage"}`}
      >
        <div className={`h-full rounded-full transition-[width] duration-500 ${onDark ? "bg-btc" : "bg-money"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function ModeBanner() {
  const { mode, t } = useApp();
  return (
    <div
      role="note"
      className={`no-print w-full px-4 py-1.5 text-center text-[11px] font-semibold tracking-wide ${
        mode.provider === "demo" ? "bg-btc text-forest" : "bg-forest text-cream"
      }`}
    >
      {mode.provider === "demo" ? t("mode.demo") : t("mode.flash")}
    </div>
  );
}

export function OfflineBanner() {
  const online = useOnline();
  const t = useT();
  if (online) return null;
  return (
    <div role="status" className="no-print bg-ink px-4 py-2 text-center text-xs text-white">
      {t("offline")}
    </div>
  );
}

export function Header({ title, back, right }: { title?: string; back?: string | true; right?: ReactNode }) {
  const router = useRouter();
  const t = useT();
  return (
    <header className="no-print flex min-h-14 items-center gap-2 px-4 pt-2">
      {back ? (
        back === true ? (
          <button onClick={() => router.back()} className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full hover:bg-sage" aria-label={t("common.back")}>
            <BackIcon />
          </button>
        ) : (
          <Link href={back} className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full hover:bg-sage" aria-label={t("common.back")}>
            <BackIcon />
          </Link>
        )
      ) : null}
      {title ? <h1 className="flex-1 truncate text-lg font-bold">{title}</h1> : <div className="flex-1" />}
      {right}
    </header>
  );
}

function BackIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

export function Screen({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <main className={`flex flex-1 flex-col px-5 pb-6 ${className}`}>{children}</main>;
}

export function StickyActions({ children }: { children: ReactNode }) {
  // --chrome-bottom is set by AppShell so CTAs clear the mobile bottom nav.
  return (
    <div className="safe-bottom sticky bottom-[var(--chrome-bottom,0px)] mt-auto space-y-3 bg-gradient-to-t from-paper via-paper to-paper/0 px-5 pt-6">
      {children}
    </div>
  );
}

export function Loading({ label }: { label?: string }) {
  const t = useT();
  return (
    <div role="status" aria-live="polite" className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-muted">
      <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-money border-t-transparent" aria-hidden />
      <span className="text-sm">{label ?? t("common.loading")}</span>
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: { status?: number; message: string; requestId?: string }; onRetry?: () => void }) {
  const t = useT();
  const notFound = error.status === 404;
  return (
    <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-danger-wash text-2xl text-danger" aria-hidden>
        !
      </div>
      <p className="max-w-xs text-[15px]">{notFound ? t("error.notFound") : error.message || t("error.generic")}</p>
      {error.requestId ? <p className="text-xs text-muted">Ref {error.requestId.slice(0, 8)}</p> : null}
      <div className="flex w-full max-w-xs flex-col gap-2">
        {onRetry && !notFound ? (
          <PillButton variant="secondary" onClick={onRetry}>
            {t("common.retry")}
          </PillButton>
        ) : null}
        <PillLink href="/home" variant="ghost">
          {t("common.back")}
        </PillLink>
      </div>
    </div>
  );
}

export function InlineError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl bg-danger-wash px-3 py-2 text-sm text-danger">
      {message}
    </p>
  );
}

export function Notice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warn" }) {
  return (
    <div className={`rounded-xl px-3 py-2.5 text-[13px] leading-snug ${tone === "warn" ? "bg-warn-wash text-[#6b3b00]" : "bg-sage text-forest"}`}>
      {children}
    </div>
  );
}

/** Accessible modal dialog using the native <dialog> element (focus trap + Esc built in). */
export function Dialog({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="m-auto w-[min(100vw-24px,420px)] rounded-[24px] bg-white p-0 text-ink backdrop:bg-ink/40"
    >
      <div className="max-h-[85dvh] overflow-y-auto p-5">
        <div className="mb-4 flex items-center gap-2">
          <h2 id={titleId} className="flex-1 text-lg font-bold">
            {title}
          </h2>
          <button onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-sage" aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

export function Field({ label, hint, children, htmlFor }: { label: string; hint?: string; children: ReactNode; htmlFor: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-semibold">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export const inputClass =
  "min-h-12 w-full rounded-2xl border border-line bg-white px-4 text-[15px] text-ink placeholder:text-muted/70 focus:border-money focus:outline-none focus-visible:outline-2";
