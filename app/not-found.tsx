import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-5xl font-extrabold text-forest">404</p>
      <p className="text-[15px] text-muted">We couldn&apos;t find that page.</p>
      <Link href="/home" className="inline-flex min-h-12 items-center rounded-full bg-money px-6 font-semibold text-white">
        Go home
      </Link>
    </main>
  );
}
