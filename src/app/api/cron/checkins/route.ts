import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { emailEnabled, sendEmails } from "@/server/email";
import { checkinEmail, type CheckinRow } from "@/server/checkinEmail";

// Called by pg_cron (migration 0029, private.checkins_tick) through pg_net
// when "Still coming?" emails are due. Bearer CHECKINS_CRON_SECRET (the same
// value sits in Supabase Vault as `checkins_cron_secret`). The DB already did
// the asking/releasing; this only claims due emails and sends them via Resend.
export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://5sfindr.com";

function authorised(req: NextRequest) {
  const secret = process.env.CHECKINS_CRON_SECRET;
  if (!secret) return false;
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

export async function POST(req: NextRequest) {
  if (!authorised(req)) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  // Without a Resend key, leave the queue alone (nothing is claimed or lost).
  if (!emailEnabled()) return NextResponse.json({ skipped: "RESEND_API_KEY not set" });

  const db = createServiceClient();
  const { data, error } = await db.rpc("claim_checkin_emails", { p_limit: 50 });
  if (error) {
    console.error("[checkins] claim failed:", error.message);
    return NextResponse.json({ error: "claim failed" }, { status: 500 });
  }

  const rows = (data ?? []) as CheckinRow[];
  const res = await sendEmails(rows.map((r) => checkinEmail(r, SITE_URL)));
  if (!res.ok) {
    console.error(`[checkins] send failed for ${rows.length} emails:`, res.error);
    return NextResponse.json({ claimed: rows.length, error: "send failed" }, { status: 502 });
  }
  return NextResponse.json({ sent: res.sent });
}
