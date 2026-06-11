import Link from "next/link";

export const metadata = { title: "Offline · 5sFindr" };

// Served by the service worker when a navigation fails offline (see next.config
// fallbacks.document). Fully static so it's always cached and available.
export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <span className="text-lg font-extrabold tracking-tight">
        5s<span className="text-pitch">Findr</span>
      </span>

      <div className="mt-8 grid h-16 w-16 place-items-center rounded-2xl border border-ink-700 bg-ink-800 text-2xl">
        📡
      </div>

      <h1 className="mt-6 text-2xl font-black tracking-tight">You’re offline</h1>
      <p className="mt-2 text-sm text-white/60">
        No connection right now. At the pitch with no data? You can still check in later with the
        organizer’s <span className="font-semibold text-white">4-digit match code</span> once you’re
        back on Wi-Fi.
      </p>

      <Link
        href="/feed"
        className="mt-8 rounded-2xl bg-pitch px-6 py-3 font-bold text-ink-900 shadow-glow transition hover:bg-pitch-dark"
      >
        Try again
      </Link>
    </main>
  );
}
