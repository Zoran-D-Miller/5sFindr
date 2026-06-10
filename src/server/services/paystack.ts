// Server-only Paystack wrapper. Currency: ZAR. Amounts are in subunits (cents):
// R20 == 2000. The R20/mo membership is a Paystack Plan; passing `plan` to a
// transaction makes Paystack auto-create the subscription once the customer pays.
import "server-only";

const BASE = "https://api.paystack.co";

function authHeaders() {
  return {
    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
    "Content-Type": "application/json",
  };
}

export interface InitTxnResult {
  authorization_url: string;
  access_code: string;
  reference: string;
}

/** Start a checkout. Pass a `plan` code to subscribe the customer to R20/mo. */
export async function initializeTransaction(params: {
  email: string;
  /** subunit amount; ignored by Paystack when a plan is supplied, but required by the API */
  amount: number;
  plan?: string;
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
}): Promise<InitTxnResult> {
  const res = await fetch(`${BASE}/transaction/initialize`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      email: params.email,
      amount: params.amount,
      plan: params.plan,
      currency: "ZAR",
      callback_url: params.callbackUrl,
      metadata: params.metadata,
    }),
    cache: "no-store",
  });
  const json = await res.json();
  if (!json.status) throw new Error(json.message ?? "Paystack init failed");
  return json.data as InitTxnResult;
}

/** Cancel an active subscription (e.g. user disables auto-renew). */
export async function disableSubscription(code: string, emailToken: string) {
  const res = await fetch(`${BASE}/subscription/disable`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ code, token: emailToken }),
    cache: "no-store",
  });
  const json = await res.json();
  if (!json.status) throw new Error(json.message ?? "Paystack disable failed");
  return json.data;
}
