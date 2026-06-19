import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// Paystack signs every webhook with HMAC-SHA512 over the raw body using your
// secret key. We verify, then bridge subscription lifecycle → our subscriptions
// table with the SERVICE ROLE (RLS blocks all client writes — this is the only
// writer). Handlers are idempotent and resolve the user even on renewals, where
// Paystack omits our original metadata.user_id.

export const dynamic = "force-dynamic";

type SubUpdate = {
  state?: "active" | "past_due" | "cancelled";
  paystack_customer_code?: string;
  paystack_subscription_code?: string;
  paystack_email_token?: string;
  current_period_end?: string | null;
  free_until?: null;
  cancel_at_period_end?: boolean;
};

type Supa = ReturnType<typeof createServiceClient>;

// Resolve our user id from an event payload: explicit metadata first (initial
// transaction), then by stored Paystack customer / subscription codes (renewals).
async function resolveUserId(supabase: Supa, data: any): Promise<string | null> {
  const metaId = data?.metadata?.user_id;
  if (metaId) return metaId as string;

  const customerCode = data?.customer?.customer_code;
  if (customerCode) {
    const { data: row } = await supabase
      .from("subscriptions").select("user_id").eq("paystack_customer_code", customerCode).maybeSingle();
    if (row?.user_id) return row.user_id;
  }

  const subCode = data?.subscription_code ?? data?.subscription?.subscription_code;
  if (subCode) {
    const { data: row } = await supabase
      .from("subscriptions").select("user_id").eq("paystack_subscription_code", subCode).maybeSingle();
    if (row?.user_id) return row.user_id;
  }
  return null;
}

function signatureValid(raw: string, signature: string | null): boolean {
  if (!signature) return false;
  const expected = createHmac("sha512", process.env.PAYSTACK_SECRET_KEY ?? "").update(raw).digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (!signatureValid(raw, req.headers.get("x-paystack-signature"))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: any;
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Bad payload" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const data = event?.data ?? {};

  try {
    switch (event.event) {
      // charge.success covers BOTH token-bundle purchases (metadata.token_qty)
      // and subscription payments (no token_qty).
      case "charge.success": {
        const qty = Number(data?.metadata?.token_qty ?? 0);

        if (qty > 0) {
          // ── Token bundle purchase → mint exactly `qty` tokens ──
          const userId = await resolveUserId(supabase, data);
          const ref: string | undefined = data?.reference;
          if (userId && ref) {
            // Idempotency: skip if this Paystack reference was already minted.
            const tag = `paystack:${ref}`;
            const { count } = await supabase
              .from("token_transactions")
              .select("id", { count: "exact", head: true })
              .eq("note", tag);
            if (!count) {
              const { data: minted } = await supabase
                .from("tokens")
                .insert(Array.from({ length: Math.min(qty, 50) }, () => ({ owner_id: userId, status: "available" })))
                .select("id");
              if (minted?.length) {
                await supabase.from("token_transactions").insert(
                  minted.map((t) => ({ token_id: t.id, user_id: userId, type: "purchase", amount_zar: 20, note: tag })),
                );
              }
            }
          }
          break;
        }

        // ── Subscription payment → activate ──
        const userId = await resolveUserId(supabase, data);
        if (userId) {
          const update: SubUpdate = { state: "active", free_until: null };
          if (data?.customer?.customer_code) update.paystack_customer_code = data.customer.customer_code;
          if (data?.next_payment_date) update.current_period_end = data.next_payment_date;
          await supabase.from("subscriptions").update(update).eq("user_id", userId);
        }
        break;
      }

      // Subscription object created — capture codes + email_token (needed to cancel).
      case "subscription.create": {
        const userId = await resolveUserId(supabase, data);
        if (userId) {
          const update: SubUpdate = { state: "active", free_until: null };
          if (data?.subscription_code) update.paystack_subscription_code = data.subscription_code;
          if (data?.email_token) update.paystack_email_token = data.email_token;
          if (data?.customer?.customer_code) update.paystack_customer_code = data.customer.customer_code;
          if (data?.next_payment_date) update.current_period_end = data.next_payment_date;
          await supabase.from("subscriptions").update(update).eq("user_id", userId);
        }
        break;
      }

      // Monthly renewal outcome. invoice.update fires after each billing attempt.
      case "invoice.create":
      case "invoice.update": {
        const userId = await resolveUserId(supabase, data);
        if (userId) {
          const paid = data?.status === "success" || data?.paid === true;
          const update: SubUpdate = paid ? { state: "active" } : { state: "past_due" };
          const nextPayment = data?.subscription?.next_payment_date ?? data?.period_end ?? null;
          if (paid && nextPayment) update.current_period_end = nextPayment;
          await supabase.from("subscriptions").update(update).eq("user_id", userId);
        }
        break;
      }

      // Explicit renewal failure → grace state.
      case "invoice.payment_failed": {
        const userId = await resolveUserId(supabase, data);
        if (userId) {
          await supabase.from("subscriptions").update({ state: "past_due" }).eq("user_id", userId);
        }
        break;
      }

      // Subscription cancelled or won't renew.
      case "subscription.disable":
      case "subscription.not_renew": {
        const userId = await resolveUserId(supabase, data);
        if (userId) {
          await supabase
            .from("subscriptions")
            .update({ state: "cancelled", cancel_at_period_end: true })
            .eq("user_id", userId);
        }
        break;
      }
    }
  } catch (e) {
    // Log but still 200 so Paystack doesn't hammer retries on a handled-but-failed write.
    console.error("[paystack webhook]", event?.event, e);
  }

  return NextResponse.json({ received: true });
}
