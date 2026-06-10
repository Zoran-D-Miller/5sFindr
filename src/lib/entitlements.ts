import { createClient } from "@/lib/supabase/server";

/**
 * Premium gate — mirrors the SQL is_premium() function so app code and RLS
 * agree on a single rule. Premium = active subscription, OR a trial whose
 * free_until is still in the future (the 30-day signup trial + referral weeks).
 *
 * FREE tier  : sign up, edit profile, view the feed, view public profiles.
 * PREMIUM tier: create matches, request to join, leaderboard, shirt colors,
 *               Man-of-the-Match voting/trophies.
 */
export async function isPremium(userId: string): Promise<boolean> {
  const supabase = createClient();
  const { data } = await supabase
    .from("subscriptions")
    .select("state, free_until, current_period_end")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) return false;
  if (data.state === "active") return true;

  if (data.state === "trialing") {
    const until = data.free_until ?? data.current_period_end;
    return until ? new Date(until).getTime() > Date.now() : false;
  }
  return false;
}
