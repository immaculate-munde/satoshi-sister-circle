"use client";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main role="alert" className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-xl font-bold">Something went wrong</p>
      <p className="text-sm text-muted">{error.digest ? `Ref ${error.digest}` : "Please try again."}</p>
      <button onClick={reset} className="inline-flex min-h-12 items-center rounded-full bg-money px-6 font-semibold text-white">
        Try again
      </button>
    </main>
  );
}
