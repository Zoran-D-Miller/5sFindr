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
