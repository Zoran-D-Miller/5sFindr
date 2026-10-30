import { headers } from "next/headers";
import Link from "next/link";
import { WaitlistForm } from "@/components/waitlist/WaitlistForm";

const POINTS = [
  {
    title: "Find a game tonight",
    body: "Every 5-a-side in Cape Town, grouped by neighbourhood. Open fields and courts, all skill levels.",
    accent: "pitch",
  },
  {
    title: "Short a player? Fill it in minutes",
    body: "Post your game, drop the link in your WhatsApp group, and newcomers claim the open spots.",
    accent: "electric",
  },
  {
    title: "Meet people who play",
    body: "New in town or just want more football? Every game is a squad of people worth knowing.",
    accent: "pitch",
  },
];

// Pre-launch: the landing page IS the waitlist. Organizers and venues on the
// list get early access to post launch-week games.
export default function LandingPage({
  searchParams,
}: {
  searchParams: { ref?: string; utm_source?: string };
}) {
  const host = headers().get("host") ?? "5sfindr.com";
  const siteUrl = `${host.startsWith("localhost") ? "http" : "https"}://${host}`;
  const refCode = searchParams.ref?.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12) || undefined;
  const source = searchParams.utm_source?.slice(0, 120) || undefined;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-16 pt-10 sm:max-w-xl">
      <header className="flex items-center justify-center">
        <span className="text-lg font-extrabold tracking-tight">
          5s<span className="text-pitch">Findr</span>
        </span>
      </header>

      <section className="mt-12 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-pitch/30 bg-pitch/10 px-3 py-1 text-xs font-semibold text-pitch">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-pitch" />
          Launching soon in Cape Town
        </span>
        <h1 className="mt-6 text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl">
          Find your next
          <br />
          <span className="text-pitch">5-a-side.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-md text-balance text-base text-white/60 sm:text-lg">
          Find or fill a game across Cape Town, and meet people who play. Free at launch.
        </p>
        <p className="mt-2 text-sm font-semibold text-white/80">
          Founding members get Premium free for their first year.
        </p>
      </section>

      <section className="mt-8">
        <WaitlistForm refCode={refCode} source={source} siteUrl={siteUrl} />
      </section>

      <div className="pitch-line my-14" />

      <section className="grid gap-4">
        {POINTS.map((p) => (
          <div key={p.title} className="card p-5">
            <h3 className={`text-heading font-bold ${p.accent === "pitch" ? "text-pitch" : "text-electric"}`}>
              {p.title}
            </h3>
            <p className="mt-1.5 text-body text-white/60">{p.body}</p>
          </div>
        ))}
      </section>

      <footer className="mt-16 text-center text-xs text-white/30">
        © {new Date().getFullYear()} 5sFindr · Cape Town, South Africa ·{" "}
        <Link href="/privacy" className="underline hover:text-white/60">
          Privacy
        </Link>
      </footer>
    </main>
  );
}
