import { escapeHtml, type Email } from "@/server/email";

// "Still coming?" email (S4). One button confirms: it opens the game's /m/
// page with the check-in token, which confirms the spot (no sign-in needed).

export interface CheckinRow {
  stage: "24h" | "3h";
  email: string;
  name: string | null;
  token: string;
  kickoff_at: string;
  venue: string | null;
  title: string | null;
  share_slug: string;
  organizer_name: string | null;
}

function timeOnly(iso: string) {
  return new Date(iso).toLocaleTimeString("en-ZA", {
    hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Johannesburg",
  });
}

function when(iso: string) {
  return new Date(iso).toLocaleString("en-ZA", {
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    hour12: false, timeZone: "Africa/Johannesburg",
  });
}

export function checkinEmail(row: CheckinRow, siteUrl: string): Email {
  const first = (row.name ?? "").split(" ")[0] || "there";
  const venue = row.venue ?? "the pitch";
  const kickoff = when(row.kickoff_at);
  const game = row.title ? `${row.title} · ${venue}` : venue;
  const organiser = row.organizer_name?.split(" ")[0] || "the organiser";
  const base = `${siteUrl}/m/${encodeURIComponent(row.share_slug)}`;
  const confirmUrl = `${base}?c=${encodeURIComponent(row.token)}`;

  const lastCall = row.stage === "3h";
  const subject = lastCall ? `Last call: still coming at ${timeOnly(row.kickoff_at)}?` : `Still coming? ${kickoff}`;
  const lead = lastCall
    ? `Kickoff is in about 3 hours. Tap below so ${organiser} knows you're coming. Spots nobody confirms are freed 90 minutes before kickoff so others can play.`
    : `You're on the list for this game. Tap below so ${organiser} knows you're coming.`;

  const text = [
    `Hi ${first},`,
    "",
    lead,
    "",
    `${game}`,
    kickoff,
    "",
    `Yes, I'm coming: ${confirmUrl}`,
    `Can't make it? Drop out here so someone else gets your spot: ${base}`,
    "",
    "You get this because you're on the list for this game. 5sFindr",
  ].join("\n");

  const html = `<!doctype html><html><body style="margin:0;background:#0b0f0c;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#fff">
<div style="max-width:480px;margin:0 auto;padding:28px 22px">
  <p style="font-size:18px;font-weight:800;margin:0 0 20px">5s<span style="color:#22c55e">Findr</span></p>
  <p style="margin:0 0 12px">Hi ${escapeHtml(first)},</p>
  <p style="margin:0 0 18px;color:#cbd5d0;line-height:1.5">${escapeHtml(lead)}</p>
  <div style="border:1px solid #23302a;border-radius:16px;padding:14px 16px;margin:0 0 20px">
    <p style="margin:0;font-weight:700">${escapeHtml(game)}</p>
    <p style="margin:4px 0 0;color:#9aa8a1">${escapeHtml(kickoff)}</p>
  </div>
  <a href="${escapeHtml(confirmUrl)}" style="display:block;text-align:center;background:#22c55e;color:#0b0f0c;font-weight:800;text-decoration:none;padding:14px;border-radius:14px">Yes, I'm coming</a>
  <p style="margin:16px 0 0;text-align:center;font-size:14px"><a href="${escapeHtml(base)}" style="color:#9aa8a1">Can't make it? Drop out so someone else gets your spot</a></p>
  <p style="margin:28px 0 0;font-size:12px;color:#6b7a72">You get this because you're on the list for this game.</p>
</div></body></html>`;

  return { to: row.email, subject, html, text };
}
