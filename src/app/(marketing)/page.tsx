import { headers } from "next/headers";
import Link from "next/link";
import { WaitlistForm } from "@/components/waitlist/WaitlistForm";
import { ClaimDemo } from "@/components/landing/ClaimDemo";
import { AreaBoard } from "@/components/unlock/AreaBoard";
import { UNLOCK } from "@/lib/areas";
import { getAreaProgress } from "@/server/areaProgress";

// Pre-launch landing page, "Open door, inner circle" (GROWTH-STRATEGY.md §6a):
// underground look, plain words. Product first (the tap-through demo), one
// main button, and a plain line under every teaser. The form is the "claim a
// spot" step: it gives a Founding Member number and counts toward the areas.
export default async function LandingPage({
  searchParams,
}: {
  searchParams: { ref?: string; utm_source?: string };
}) {
  const host = headers().get("host") ?? "5sfindr.com";
  const siteUrl = `${host.startsWith("localhost") ? "http" : "https"}://${host}`;
  const refCode = searchParams.ref?.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12) || undefined;
  const source = searchParams.utm_source?.slice(0, 120) || undefined;
  const areas = await getAreaProgress();

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-16 pt-6 sm:max-w-xl">
      <header className="flex items-center justify-between">
        <span className="text-lg font-extrabold tracking-tight">
          5s<span className="text-pitch">Findr</span>
        </span>
        <span className="font-mono text-micro uppercase tracking-widest text-white/40">33.92° S · 18.42° E</span>
      </header>

      <section className="mt-10">
        <p className="font-mono text-micro uppercase tracking-widest text-pitch">Cape Town · 5-a-side · Free</p>
        <h1 className="mt-3 font-display text-[3.25rem] font-extrabold uppercase leading-[0.92] tracking-tight sm:text-7xl">
          Find a game.
          <br />
          <span className="text-pitch">Fill yours.</span>
        </h1>
        <p className="mt-4 max-w-md text-balance text-body text-white/60 sm:text-base">
          Free 5-a-side games across Cape Town, posted by the people who run them. Join one with your first name and
          WhatsApp number, and meet people who play.
        </p>
      </section>

      <div className="mt-8">
        <ClaimDemo />
      </div>

      <div className="mt-6">
        <a href="#claim" className="btn-primary block" data-umami-event="landing-claim">
          Claim your spot
        </a>
        <p className="mt-2 text-center text-meta text-white/45">
          Free. Founding members are numbered and get Premium free for their first year.
        </p>
      </div>

      {areas && (
        <section className="mt-14">
          <h2 className="font-display text-title font-extrabold uppercase tracking-wide">
            Areas open at {UNLOCK.players}
          </h2>
          <p className="mb-4 mt-1 text-body text-white/55">
            Anyone with a game’s link can join it today. Each area’s feed opens to everyone once it has{" "}
            {UNLOCK.players} players and {UNLOCK.weeklyGames} weekly games. Every signup counts.
          </p>
          <AreaBoard areas={areas} />
        </section>
      )}

      <section id="claim" className="mt-14 scroll-mt-6">
        <h2 className="font-display text-title font-extrabold uppercase tracking-wide">Claim your spot</h2>
        <p className="mb-4 mt-1 text-body text-white/55">
          Tell us where you play. You get your Founding Member number and a link to bring your mates.
        </p>
        <WaitlistForm refCode={refCode} source={source} siteUrl={siteUrl} />
        <p className="mt-4 text-center text-sm text-white/60">
          Run a regular game?{" "}
          <Link href="/organise" className="font-semibold text-pitch underline">
            Post it now, free
          </Link>
        </p>
      </section>

      <footer className="mt-16 text-center text-xs text-white/30">
        © {new Date().getFullYear()} 5sFindr · Cape Town, South Africa ·{" "}
        <Link href="/privacy" className="underline hover:text-white/60">
          Privacy
        </Link>{" "}
        ·{" "}
        <Link href="/terms" className="underline hover:text-white/60">
          Terms
        </Link>
      </footer>
    </main>
  );
}
