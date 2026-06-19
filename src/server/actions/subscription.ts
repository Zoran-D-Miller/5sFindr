"use server";

import { createClient } from "@/lib/supabase/server";
import { initializeTransaction } from "@/server/services/paystack";

export type StartSubResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

// Build an absolute callback URL to the frontend /wallet page using ONLY the
// origin of NEXT_PUBLIC_SITE_URL. This is defensive: if that env var ever holds
// a path (e.g. the webhook URL was pasted in), naive `${site}/wallet` would
// resolve to /api/webhooks/paystack/wallet → 404 after payment.
function walletCallback(query: string): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  let origin: string;
  try {
    origin = new URL(raw).origin;
  } catch {
    origin = "http://localhost:3000";
  }
  return `${origin}/wallet${query}`;
}

/**
 * Begin the R20/mo Premium subscription via Paystack. Returns the hosted
 * checkout URL — the client redirects there. The subscription row is flipped
 * to `active` by the webhook once Paystack confirms the first charge, so the
 * trial → paid transition is never trusted to the browser.
 */
export async function startSubscription(): Promise<StartSubResult> {
  try {
    if (!process.env.PAYSTACK_SECRET_KEY) {
      return { ok: false, error: "Payments aren’t configured yet. Please try again later." };
    }
    const plan = process.env.PAYSTACK_PLAN_CODE;
    if (!plan) return { ok: false, error: "Subscription plan not configured." };

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) return { ok: false, error: "Please log in again." };

    const { authorization_url } = await initializeTransaction({
      email: user.email,
      amount: 2000, // R20 in cents
      plan,
      callbackUrl: walletCallback("?upgraded=1"),
      metadata: { user_id: user.id },
    });
    return { ok: true, url: authorization_url };
  } catch (e) {
    console.error("[startSubscription]", e);
    return { ok: false, error: "Couldn’t start checkout — please try again." };
  }
}

// Token bundles — priced to absorb Paystack's fixed fee at volume.
// qty → ZAR amount in cents. NOT exported: a "use server" file may only export
// async functions (a non-async export breaks the client-action boundary build).
const TOKEN_BUNDLES: Record<number, { cents: number; label: string }> = {
  1: { cents: 2000, label: "R20" },
  5: { cents: 9000, label: "R90" },
  10: { cents: 17000, label: "R170" },
};

/**
 * Buy a token bundle (1, 5, or 10) via Paystack. The webhook mints exactly
 * token_qty tokens on charge.success (idempotent by Paystack reference).
 */
export async function purchaseTokens(qty: 1 | 5 | 10): Promise<StartSubResult> {
  // Whole body wrapped: a missing env (requireEnv throws), a Supabase/Paystack
  // network failure, etc. must return an error object — never throw and crash
  // the client boundary with a 500.
  try {
    if (!process.env.PAYSTACK_SECRET_KEY) {
      return { ok: false, error: "Payments aren’t configured yet. Please try again later." };
    }
    const bundle = TOKEN_BUNDLES[qty];
    if (!bundle) return { ok: false, error: "Invalid bundle." };

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) return { ok: false, error: "Please log in again." };

    const { authorization_url } = await initializeTransaction({
      email: user.email,
      amount: bundle.cents,
      callbackUrl: walletCallback("?topup=1"),
      metadata: { user_id: user.id, token_qty: qty },
    });
    return { ok: true, url: authorization_url };
  } catch (e) {
    console.error("[purchaseTokens]", e);
    return { ok: false, error: "Couldn’t start checkout — please try again." };
  }
}
