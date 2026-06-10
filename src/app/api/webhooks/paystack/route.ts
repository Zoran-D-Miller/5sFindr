import { createHmac } from "crypto";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// Paystack signs every webhook with HMAC-SHA512 over the raw body using your
// secret key. We verify, then update subscriptions with the SERVICE ROLE
// (RLS blocks all client writes to subscriptions — this is the only writer).
export async function POST(req: Request) {
  const raw = await req.text();
  const signature = req.headers.get("x-paystack-signature");
  const expected = createHmac("sha512", process.env.PAYSTACK_SECRET_KEY ?? "")
    .update(raw)
    .digest("hex");

  if (!signature || signature !== expected) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(raw);
  const supabase = createServiceClient();

  switch (event.event) {
    // First successful charge / renewal → Premium active
    case "charge.success":
    case "subscription.create": {
      const userId = event.data?.metadata?.user_id;
      const customerCode = event.data?.customer?.customer_code;
      const subCode = event.data?.subscription_code ?? null;
      const nextPayment = event.data?.next_payment_date ?? null;
      if (userId) {
        await supabase
          .from("subscriptions")
          .update({
            state: "active",
            paystack_customer_code: customerCode,
            paystack_subscription_code: subCode,
            current_period_end: nextPayment,
            free_until: null, // trial period is over once they're paying
          })
          .eq("user_id", userId);
      }
      break;
    }

    // Renewal failed → grace state
    case "invoice.payment_failed": {
      const subCode = event.data?.subscription?.subscription_code;
      if (subCode) {
        await supabase
          .from("subscriptions")
          .update({ state: "past_due" })
          .eq("paystack_subscription_code", subCode);
      }
      break;
    }

    // Subscription cancelled / exhausted
    case "subscription.disable":
    case "subscription.not_renew": {
      const subCode = event.data?.subscription_code;
      if (subCode) {
        await supabase
          .from("subscriptions")
          .update({ state: "cancelled", cancel_at_period_end: true })
          .eq("paystack_subscription_code", subCode);
      }
      break;
    }
  }

  // Always 200 quickly so Paystack doesn't retry a handled event.
  return NextResponse.json({ received: true });
}
