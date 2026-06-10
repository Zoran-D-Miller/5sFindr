import { createClient } from "@/lib/supabase/server";
import { ProfileEditor } from "@/components/profile/ProfileEditor";
import type { Profile } from "@/lib/types";

export default async function ProfileEditPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user!.id)
    .single<Profile>();

  if (!profile) {
    return <p className="text-white/60">Setting up your profile…</p>;
  }

  return (
    <>
      <h1 className="mb-6 text-2xl font-black tracking-tight">Your profile</h1>
      <ProfileEditor profile={profile} />
    </>
  );
}
