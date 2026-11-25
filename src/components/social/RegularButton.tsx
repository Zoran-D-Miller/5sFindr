"use client";

import { useState, useTransition } from "react";
import { setRegular } from "@/server/actions/social";

// Add / remove someone you've played with as a regular.
export function RegularButton({ userId, isRegular }: { userId: string; isRegular: boolean }) {
  const [on, setOn] = useState(isRegular);
  const [pending, start] = useTransition();
  const [error, setError] = useState("");

  function toggle() {
    setError("");
    const next = !on;
    setOn(next); // optimistic
    start(async () => {
      const res = await setRegular(userId, next);
      if (!res.ok) {
        setOn(!next);
        setError(res.error);
      }
    });
  }

  return (
    <span className="flex shrink-0 flex-col items-end">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={on}
        className={`rounded-full border px-3 py-1 text-xs font-bold transition disabled:opacity-60 ${
          on ? "border-pitch bg-pitch/15 text-pitch" : "border-ink-600 text-white/60 hover:border-pitch/50"
        }`}
      >
        {on ? "★ Regular" : "+ Regular"}
      </button>
      {error && <span className="mt-1 max-w-[12rem] text-right text-[11px] text-red-400">{error}</span>}
    </span>
  );
}
