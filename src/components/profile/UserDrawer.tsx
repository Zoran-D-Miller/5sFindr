"use client";

import { useEffect, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { followUser, unfollowUser } from "@/server/actions/social";
import { Avatar } from "@/components/ui/Avatar";
import { FollowList } from "./FollowList";
import { foundingTier, FOUNDING_LABEL, POSITION_BADGE } from "@/lib/positions";
import type { DrawerProfile } from "@/lib/types";

function joinedLabel(iso: string) {
  return "Joined " + new Date(iso).toLocaleDateString("en-ZA", { month: "short", year: "numeric" });
}

// Premium profile peek. Followers/Following counts are clickable → open a
// FollowList; selecting someone there opens a nested peek (recursive), so the
// social graph is fully traversable.
export function UserDrawer({
  userId,
  fallbackName = "Player",
  onClose,
}: {
  userId: string;
  fallbackName?: string;
  onClose: () => void;
}) {
  const [shown, setShown] = useState(false);
  const [profile, setProfile] = useState<DrawerProfile | null>(null);
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isSelf, setIsSelf] = useState(false);
  const [pending, start] = useTransition();
  const [listMode, setListMode] = useState<"followers" | "following" | null>(null);
  const [nestedPeek, setNestedPeek] = useState<string | null>(null);

  useEffect(() => {
    setShown(true);
    const supabase = createClient();
    (async () => {
      const [{ data: p }, { count: fers }, { count: fing }, { data: auth }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, name, avatar_url, bio, neighborhood, preferred_positions, reliability_score, motm_count, founding_number, created_at")
          .eq("id", userId)
          .single<DrawerProfile>(),
        supabase.from("follows").select("id", { count: "exact", head: true }).eq("following_id", userId),
        supabase.from("follows").select("id", { count: "exact", head: true }).eq("follower_id", userId),
        supabase.auth.getUser(),
      ]);
      if (p) setProfile(p);
      setFollowers(fers ?? 0);
      setFollowing(fing ?? 0);
      const me = auth.user?.id;
      setIsSelf(me === userId);
      if (me && me !== userId) {
        const { data: rel } = await supabase
          .from("follows").select("id").eq("follower_id", me).eq("following_id", userId).maybeSingle();
        setIsFollowing(!!rel);
      }
    })();
  }, [userId]);

  function toggleFollow() {
    start(async () => {
      if (isFollowing) {
        const r = await unfollowUser(userId);
        if (r.ok) { setIsFollowing(false); setFollowers((n) => Math.max(0, n - 1)); }
      } else {
        const r = await followUser(userId);
        if (r.ok) { setIsFollowing(true); setFollowers((n) => n + 1); }
      }
    });
  }

  const tier = foundingTier(profile?.founding_number);
  const countBtn = "font-bold text-white transition hover:text-pitch";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`relative w-full max-w-md rounded-t-3xl border-t border-ink-600 bg-ink-800 p-6 pb-8 transition-transform duration-300 ease-out ${
          shown ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="mx-auto mb-5 h-1.5 w-10 rounded-full bg-ink-600" />

        <div className="flex items-center gap-4">
          <Avatar name={profile?.name ?? fallbackName} url={profile?.avatar_url} size={72} foundingNumber={profile?.founding_number} />
          <div className="min-w-0">
            <p className="truncate text-xl font-black">{profile?.name ?? fallbackName}</p>
            {tier && (
              <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${tier === "baller" ? "bg-yellow-400/15 text-yellow-400" : "bg-zinc-300/15 text-zinc-300"}`}>
                {FOUNDING_LABEL[tier]}
              </span>
            )}
          </div>
        </div>

        {profile?.bio && <p className="mt-4 text-sm leading-relaxed text-white/70">{profile.bio}</p>}

        <div className="mt-5 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl border border-ink-700 bg-ink-900 p-3">
            <p className="text-lg font-black text-pitch">{Math.round(profile?.reliability_score ?? 100)}%</p>
            <p className="text-[10px] uppercase tracking-wide text-white/40">Reliability</p>
          </div>
          <div className="rounded-2xl border border-ink-700 bg-ink-900 p-3">
            <p className="text-lg font-black text-yellow-400">🏆 {profile?.motm_count ?? 0}</p>
            <p className="text-[10px] uppercase tracking-wide text-white/40">MotM</p>
          </div>
          <div className="rounded-2xl border border-ink-700 bg-ink-900 p-3">
            <p className="text-lg font-black">{(profile?.preferred_positions ?? []).map((p) => POSITION_BADGE[p]).join(" ") || "ANY"}</p>
            <p className="text-[10px] uppercase tracking-wide text-white/40">Position</p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-white/60">
            <button type="button" className={countBtn} onClick={() => setListMode("followers")}>{followers}</button> Followers ·{" "}
            <button type="button" className={countBtn} onClick={() => setListMode("following")}>{following}</button> Following
          </span>
          <span className="text-xs text-white/40">
            {profile ? joinedLabel(profile.created_at) : ""}
            {profile?.neighborhood ? ` · ${profile.neighborhood}` : ""}
          </span>
        </div>

        {!isSelf && (
          <button
            type="button"
            onClick={toggleFollow}
            disabled={pending}
            className={`mt-5 w-full rounded-2xl py-3 font-bold transition disabled:opacity-60 ${
              isFollowing
                ? "border border-ink-600 text-white/70 hover:border-white/40"
                : "bg-pitch text-ink-900 shadow-glow hover:bg-pitch-dark"
            }`}
          >
            {isFollowing ? "Following ✓" : "Follow"}
          </button>
        )}
      </div>

      {listMode && (
        <FollowList
          userId={userId}
          mode={listMode}
          onClose={() => setListMode(null)}
          onSelect={(id) => { setListMode(null); setNestedPeek(id); }}
        />
      )}
      {nestedPeek && <UserDrawer userId={nestedPeek} onClose={() => setNestedPeek(null)} />}
    </div>
  );
}
