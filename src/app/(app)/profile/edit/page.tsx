import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { InviteCard } from "@/components/profile/InviteCard";
import { AreaBoard } from "@/components/unlock/AreaBoard";
import { areaFor, areaLabel } from "@/lib/areas";
import { PRELAUNCH } from "@/lib/flags";
import { getAreaProgress } from "@/server/areaProgress";
import { ProfileEditor } from "@/components/profile/ProfileEditor";
import { CommunityBanner } from "@/components/CommunityBanner";
import type { Profile } from "@/lib/types";

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
  const [{ data: profile }, { count: followers }, { count: following }, { data: invited }, areas] = await Promise.all([
    supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", uid).single<Profile>(),
    supabase.from("follows").select("id", { count: "exact", head: true }).eq("following_id", uid),
    supabase.from("follows").select("id", { count: "exact", head: true }).eq("follower_id", uid),
    supabase.rpc("my_invites"),
    PRELAUNCH ? getAreaProgress() : Promise.resolve(null),
  ]);

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
      <div className="mb-6">
        <CommunityBanner />
      </div>
      <ProfileEditor profile={profile} followers={followers ?? 0} following={following ?? 0} />
    </>
  );
}
