import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { InviteCard } from "@/components/profile/InviteCard";
import { AreaBoard } from "@/components/unlock/AreaBoard";
import { areaFor, areaLabel } from "@/lib/areas";
import { PRELAUNCH } from "@/lib/flags";
import { getAreaProgress } from "@/server/areaProgress";
import { ProfileEditor } from "@/components/profile/ProfileEditor";
import { CommunityBanner } from "@/components/CommunityBanner";
import { PlayedWith } from "@/components/social/PlayedWith";
import { RegularsEmailToggle } from "@/components/social/RegularsEmailToggle";
import { ShareImage } from "@/components/share/ShareImage";
import type { Profile } from "@/lib/types";

interface PlayedWithRow {
  user_id: string;
  name: string;
  avatar_url: string | null;
  games_together: number;
  is_regular: boolean;
}

// Explicit columns, not "*": profiles uses column-level grants (0025) and
// select * fails on any column the caller can't read (phone_number).
const PROFILE_COLUMNS =
  "id, name, profile_picture_url, avatar_url, bio, neighborhood, skill_level, preferred_positions, weekly_availability, public_slug, instagram_url, tiktok_url, reliability_score, games_played, games_missed, motm_count, founding_number, referral_code, referred_by_id";

export default async function ProfileEditPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const uid = user!.id;
  const [{ data: profile }, { count: followers }, { count: following }, { data: invited }, areas, { data: playedWith }, { data: settings }] = await Promise.all([
    supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", uid).single<Profile>(),
    supabase.from("follows").select("id", { count: "exact", head: true }).eq("following_id", uid),
    supabase.from("follows").select("id", { count: "exact", head: true }).eq("follower_id", uid),
    supabase.rpc("my_invites"),
    PRELAUNCH ? getAreaProgress() : Promise.resolve(null),
    supabase.rpc("my_played_with", { p_limit: 60 }),
    supabase.from("user_settings").select("regulars_email").eq("user_id", uid).maybeSingle<{ regulars_email: boolean }>(),
  ]);

  const played = (playedWith ?? []) as PlayedWithRow[];

  if (!profile) {
    return <p className="text-white/60">Setting up your profile…</p>;
  }

  const host = headers().get("host") ?? "5sfindr.com";
  const siteUrl = `${host.startsWith("localhost") ? "http" : "https"}://${host}`;
  const home = areaFor(profile.neighborhood);

  return (
    <>
      <h1 className="mb-6 text-2xl font-black tracking-tight">Your profile</h1>
      <div className="mb-6 space-y-4">
        <InviteCard
          foundingNumber={profile.founding_number}
          code={profile.referral_code}
          invited={Number(invited ?? 0)}
          siteUrl={siteUrl}
          areaLabel={home === "other" ? null : areaLabel(home)}
        />
        {areas && <AreaBoard areas={areas} highlight={home} />}
      </div>

      {/* S6: player card for IG stories */}
      <section className="mb-6 space-y-2 rounded-2xl border border-ink-700 bg-ink-800/60 p-4">
        <h3 className="text-sm font-bold uppercase tracking-wide text-white/50">Your player card</h3>
        <p className="text-xs text-white/50">Games, show-up rate and how many people you’ve played with. Sized for a story.</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/card/player/${profile.public_slug}`}
          alt="Your player card"
          className="mx-auto w-32 rounded-xl border border-ink-700"
        />
        <ShareImage
          src={`/api/card/player/${profile.public_slug}`}
          filename="5sfindr-player-card.png"
          label="Share your player card"
          via="player_card"
        />
      </section>

      {/* S6: played with + regulars */}
      <div className="mb-6 space-y-3">
        {played.length > 0 ? (
          <PlayedWith
            title="Played with"
            intro="Your regulars are private to you. When one joins a game you’re not on, it shows on your games page."
            people={played.map((p) => ({
              user_id: p.user_id,
              name: p.name,
              avatar_url: p.avatar_url,
              is_regular: p.is_regular,
              note: `${p.games_together} game${p.games_together === 1 ? "" : "s"} together`,
            }))}
          />
        ) : (
          <p className="rounded-2xl border border-ink-700 bg-ink-800/60 p-3 text-xs text-white/50">
            After your first game, the people you played with show up here. Add them as regulars to see when they play.
          </p>
        )}
        <RegularsEmailToggle on={settings?.regulars_email ?? true} hasEmail={!!user?.email} />
      </div>
      <div className="mb-6">
        <CommunityBanner />
      </div>
      <ProfileEditor profile={profile} followers={followers ?? 0} following={following ?? 0} />
    </>
  );
}
