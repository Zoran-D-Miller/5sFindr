import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { emailEnabled, sendEmails } from "@/server/email";
import { checkinEmail, type CheckinRow } from "@/server/checkinEmail";
import { regularAlertEmail, type RegularAlertEmailRow } from "@/server/regularAlertEmail";

// Called by pg_cron (migration 0029, private.checkins_tick) through pg_net
// when "Still coming?" emails or (S6, 0031) "your regulars are playing" emails are due. Bearer CHECKINS_CRON_SECRET (the same
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
  // Up to 50 of each, so one Resend batch (max 100) holds both.
  const [checkins, alerts] = await Promise.all([
    db.rpc("claim_checkin_emails", { p_limit: 50 }),
    db.rpc("claim_regular_alert_emails", { p_limit: 50 }),
  ]);
  if (checkins.error) console.error("[checkins] claim failed:", checkins.error.message);
  if (alerts.error) console.error("[checkins] regular alerts claim failed:", alerts.error.message);
  if (checkins.error && alerts.error) return NextResponse.json({ error: "claim failed" }, { status: 500 });

  const emails = [
    ...((checkins.data ?? []) as CheckinRow[]).map((r) => checkinEmail(r, SITE_URL)),
    ...((alerts.data ?? []) as RegularAlertEmailRow[]).map((r) => regularAlertEmail(r, SITE_URL)),
  ];
  const res = await sendEmails(emails);
  if (!res.ok) {
    console.error(`[checkins] send failed for ${emails.length} emails:`, res.error);
    return NextResponse.json({ claimed: emails.length, error: "send failed" }, { status: 502 });
  }
  return NextResponse.json({ sent: res.sent });
}
