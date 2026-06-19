import { createClient } from "@/lib/supabase/server";
import { ProfileEditor } from "@/components/profile/ProfileEditor";
import { CommunityBanner } from "@/components/CommunityBanner";
import type { Profile } from "@/lib/types";

export default async function ProfileEditPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const uid = user!.id;
  const [{ data: profile }, { count: followers }, { count: following }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", uid).single<Profile>(),
    supabase.from("follows").select("id", { count: "exact", head: true }).eq("following_id", uid),
    supabase.from("follows").select("id", { count: "exact", head: true }).eq("follower_id", uid),
  ]);

  if (!profile) {
    return <p className="text-white/60">Setting up your profile…</p>;
  }

  return (
    <>
      <h1 className="mb-6 text-2xl font-black tracking-tight">Your profile</h1>
      <div className="mb-6">
        <CommunityBanner />
      </div>
      <ProfileEditor profile={profile} followers={followers ?? 0} following={following ?? 0} />
    </>
  );
}
