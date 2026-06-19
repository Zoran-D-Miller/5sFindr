"use client";

import { useState, useTransition } from "react";
import { startSubscription } from "@/server/actions/subscription";
import type { Subscription } from "@/lib/types";

function daysLeft(iso: string | null): number {
  if (!iso) return 0;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
}

export function SubscriptionCard({ subscription }: { subscription: Subscription }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const trialDays = daysLeft(subscription.free_until);
  const isActive = subscription.state === "active";
  const isTrialing = subscription.state === "trialing" && trialDays > 0;

  function upgrade() {
    setError("");
    startTransition(async () => {
      try {
        const res = await startSubscription();
        if (res.ok) window.location.href = res.url;
        else setError(res.error);
      } catch {
        setError("Couldn’t start checkout — please try again.");
      }
    });
  }

  return (
    <section className="rounded-3xl border border-electric/30 bg-gradient-to-b from-electric/10 to-transparent p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-white/50">Membership</p>
          <p className="mt-0.5 text-lg font-extrabold">
            {isActive ? "Premium · active" : isTrialing ? "Premium trial" : "Free"}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${
            isActive || isTrialing
              ? "bg-pitch/15 text-pitch"
              : "bg-ink-700 text-white/50"
          }`}
        >
          {isActive ? "ACTIVE" : isTrialing ? `${trialDays}d left` : "LOCKED"}
        </span>
      </div>

      {isTrialing && (
        <p className="mt-3 text-sm text-white/60">
          You’ve got full access for {trialDays} more day{trialDays === 1 ? "" : "s"}.
          Keep creating and joining matches for just R20/month after that.
        </p>
      )}

      {!isActive && (
        <>
          <button
            type="button"
            onClick={upgrade}
            disabled={pending}
            className="mt-5 w-full rounded-2xl bg-electric py-3.5 font-bold text-white transition hover:bg-electric-dark disabled:opacity-60"
          >
            {pending ? "Opening checkout…" : "Go Premium — R20/month"}
          </button>
          {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
        </>
      )}
    </section>
  );
}
