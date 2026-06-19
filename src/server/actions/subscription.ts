"use server";

import { createClient } from "@/lib/supabase/server";
import { initializeTransaction } from "@/server/services/paystack";

export type StartSubResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

/**
 * Begin the R20/mo Premium subscription via Paystack. Returns the hosted
 * checkout URL — the client redirects there. The subscription row is flipped
 * to `active` by the webhook once Paystack confirms the first charge, so the
 * trial → paid transition is never trusted to the browser.
 */
export async function startSubscription(): Promise<StartSubResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false, error: "Not signed in." };

  const plan = process.env.PAYSTACK_PLAN_CODE;
  if (!plan) return { ok: false, error: "Subscription plan not configured." };

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  try {
    const { authorization_url } = await initializeTransaction({
      email: user.email,
      amount: 2000, // R20 in cents
      plan,
      callbackUrl: `${site}/wallet?upgraded=1`,
      metadata: { user_id: user.id },
    });
    return { ok: true, url: authorization_url };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Checkout failed." };
  }
}

// Token bundles — priced to absorb Paystack's fixed fee at volume.
// qty → ZAR amount in cents.
export const TOKEN_BUNDLES: Record<number, { cents: number; label: string }> = {
  1: { cents: 2000, label: "R20" },
  5: { cents: 9000, label: "R90" },
  10: { cents: 17000, label: "R170" },
};

/**
 * Buy a token bundle (1, 5, or 10) via Paystack. The webhook mints exactly
 * token_qty tokens on charge.success (idempotent by Paystack reference).
 */
export async function purchaseTokens(qty: 1 | 5 | 10): Promise<StartSubResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false, error: "Not signed in." };

  const bundle = TOKEN_BUNDLES[qty];
  if (!bundle) return { ok: false, error: "Invalid bundle." };

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  try {
    const { authorization_url } = await initializeTransaction({
      email: user.email,
      amount: bundle.cents,
      callbackUrl: `${site}/wallet?topup=1`,
      metadata: { user_id: user.id, token_qty: qty },
    });
    return { ok: true, url: authorization_url };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Checkout failed." };
  }
}
