"use client";

import { useState, useTransition } from "react";
import { setRegularsEmail } from "@/server/actions/social";

// Profile setting: email me when one of my regulars joins a game I'm not on.
export function RegularsEmailToggle({ on, hasEmail }: { on: boolean; hasEmail: boolean }) {
  const [value, setValue] = useState(on);
  const [pending, start] = useTransition();
  const [error, setError] = useState("");

  function toggle() {
    setError("");
    const next = !value;
    setValue(next);
    start(async () => {
      const res = await setRegularsEmail(next);
      if (!res.ok) {
        setValue(!next);
        setError(res.error);
      }
    });
  }

  return (
    <div className="rounded-2xl border border-ink-700 bg-ink-800/60 p-3">
      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={value && hasEmail}
          onChange={toggle}
          disabled={pending || !hasEmail}
          className="h-4 w-4 accent-pitch"
        />
        <span className="flex-1">
          Email me when a regular joins a game I’m not on
          <span className="block text-xs text-white/40">
            {hasEmail
              ? "At most one email every 12 hours. You also see them on your games page."
              : "Needs an email on your account. You still see them on your games page."}
          </span>
        </span>
      </label>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}
