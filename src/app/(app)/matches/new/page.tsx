import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isPremium } from "@/lib/entitlements";

// Stub for the Phase 4 match-creation engine. Premium-gated so the surface
// is correct now; the full venue picker + join settings land next phase.
export default async function NewMatchPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!(await isPremium(user!.id))) redirect("/wallet");

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-black tracking-tight">Create a match</h1>
      <div className="rounded-2xl border border-dashed border-pitch/30 bg-pitch/5 px-5 py-12 text-center">
        <p className="text-3xl">🏟️</p>
        <p className="mt-3 font-semibold text-white/80">Match-creation engine</p>
        <p className="mx-auto mt-1 max-w-xs text-sm text-white/50">
          Venue picker (seeded Cape Town courts or drop-a-pin), kickoff time,
          and Instant vs Request join settings — landing in Phase 4.
        </p>
        <Link
          href="/feed"
          className="mt-6 inline-block rounded-2xl border border-ink-600 px-5 py-2.5 text-sm font-semibold text-white/70 transition hover:border-pitch hover:text-white"
        >
          Back to feed
        </Link>
      </div>
    </div>
  );
}
