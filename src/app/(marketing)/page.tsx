import Link from "next/link";

const FEATURES = [
  {
    title: "Find a game tonight",
    body: "Browse live 5-a-side matches across Cape Town — official courts or community fields. Filter by neighborhood, time, and skill.",
    accent: "pitch",
  },
  {
    title: "Commit with a token",
    body: "Hold your spot with one R20 token. Show up and it bounces straight back to you. Bail late and you forfeit it — so squads actually fill.",
    accent: "electric",
  },
  {
    title: "Build your reliability",
    body: "Every game played lifts your score. Ghost a match and it drops. Managers see exactly who shows up before they let you in.",
    accent: "pitch",
  },
];

const STEPS = [
  ["01", "Sign up", "30 days of Premium free, plus one free token in your wallet. No card needed."],
  ["02", "Claim a spot", "Commit your token to any open match. Instant-book if you meet the manager's bar, or send a request."],
  ["03", "Check in & play", "Tap to verify by GPS at the pitch — or enter the manager's 4-digit code later. Token returns. Score climbs."],
];

export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-16 pt-10 sm:max-w-2xl">
      {/* Brand */}
      <header className="flex items-center justify-between">
        <span className="text-lg font-extrabold tracking-tight">
          5s<span className="text-pitch">Findr</span>
        </span>
        <Link
          href="/login"
          className="rounded-full border border-ink-600 px-4 py-1.5 text-sm font-medium text-white/80 transition hover:border-pitch hover:text-white"
        >
          Log in
        </Link>
      </header>

      {/* Hero */}
      <section className="mt-16 text-center sm:mt-24">
        <span className="inline-flex items-center gap-2 rounded-full border border-pitch/30 bg-pitch/10 px-3 py-1 text-xs font-semibold text-pitch">
          <span className="h-1.5 w-1.5 rounded-full bg-pitch" />
          Now live in Cape Town
        </span>
        <h1 className="mt-6 text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl">
          Find your next
          <br />
          <span className="text-pitch">5-a-side.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-md text-balance text-base text-white/60 sm:text-lg">
          It’s Tinder meets Strava for football. Match with games near you, commit a token,
          and build a reliability score that gets you picked.
        </p>

        <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/signup"
            className="rounded-2xl bg-pitch px-6 py-3.5 text-center font-bold text-ink-900 shadow-glow transition hover:bg-pitch-dark"
          >
            Get your first month free
          </Link>
          <Link
            href="/feed"
            className="rounded-2xl border border-ink-600 px-6 py-3.5 text-center font-semibold text-white/80 transition hover:border-electric hover:text-white"
          >
            Browse games
          </Link>
        </div>
        <p className="mt-3 text-xs text-white/40">30-day Premium trial · 1 free token · no card required</p>
      </section>

      <div className="pitch-line my-16" />

      {/* Features */}
      <section className="grid gap-4">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="rounded-2xl border border-ink-700 bg-ink-800/60 p-5 backdrop-blur"
          >
            <h3
              className={`text-lg font-bold ${f.accent === "pitch" ? "text-pitch" : "text-electric"}`}
            >
              {f.title}
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-white/60">{f.body}</p>
          </div>
        ))}
      </section>

      {/* How it works */}
      <section className="mt-16">
        <h2 className="text-center text-2xl font-extrabold tracking-tight">How it works</h2>
        <div className="mt-8 space-y-6">
          {STEPS.map(([n, title, body]) => (
            <div key={n} className="flex gap-4">
              <span className="font-mono text-sm font-bold text-pitch">{n}</span>
              <div>
                <h4 className="font-bold">{title}</h4>
                <p className="mt-1 text-sm leading-relaxed text-white/55">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mt-16 rounded-3xl border border-pitch/20 bg-gradient-to-b from-pitch/10 to-transparent p-8 text-center">
        <h2 className="text-2xl font-black tracking-tight">Ready to ball?</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-white/60">
          Join the Cape Town founding squad. Refer a mate and you both get more free weeks.
        </p>
        <Link
          href="/signup"
          className="mt-6 inline-block rounded-2xl bg-pitch px-8 py-3.5 font-bold text-ink-900 shadow-glow transition hover:bg-pitch-dark"
        >
          Create my profile
        </Link>
      </section>

      <footer className="mt-16 text-center text-xs text-white/30">
        © {new Date().getFullYear()} 5sFindr · Cape Town, South Africa
      </footer>
    </main>
  );
}
