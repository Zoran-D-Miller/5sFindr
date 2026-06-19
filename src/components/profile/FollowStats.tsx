"use client";

import { useState } from "react";
import { FollowList } from "./FollowList";
import { UserDrawer } from "./UserDrawer";

// Clickable Followers / Following counts for the profile page. Opens the
// matching list; selecting someone opens their peek drawer.
export function FollowStats({
  userId,
  followers,
  following,
}: {
  userId: string;
  followers: number;
  following: number;
}) {
  const [mode, setMode] = useState<"followers" | "following" | null>(null);
  const [peek, setPeek] = useState<string | null>(null);
  const btn = "font-bold text-white transition hover:text-pitch";

  return (
    <>
      <span className="text-sm text-white/60">
        <button type="button" className={btn} onClick={() => setMode("followers")}>{followers}</button> Followers ·{" "}
        <button type="button" className={btn} onClick={() => setMode("following")}>{following}</button> Following
      </span>

      {mode && (
        <FollowList
          userId={userId}
          mode={mode}
          onClose={() => setMode(null)}
          onSelect={(id) => { setMode(null); setPeek(id); }}
        />
      )}
      {peek && <UserDrawer userId={peek} onClose={() => setPeek(null)} />}
    </>
  );
}
