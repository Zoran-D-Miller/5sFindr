import { escapeHtml, type Email } from "@/server/email";

// "Your regulars are playing" email (S6). One per person at most every 12h,
// claimed by /api/cron/checkins through claim_regular_alert_emails() (0031).

export interface RegularAlertEmailRow {
  email: string;
  name: string | null;
  share_slug: string;
  title: string | null;
  kickoff_at: string;
  venue: string | null;
  spots_left: number;
  regulars: string[];
}

function when(iso: string) {
  return new Date(iso).toLocaleString("en-ZA", {
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    hour12: false, timeZone: "Africa/Johannesburg",
  });
}

function names(list: string[]) {
  if (list.length <= 1) return list[0] ?? "One of your regulars";
  if (list.length === 2) return `${list[0]} and ${list[1]}`;
  return `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;
}

export function regularAlertEmail(row: RegularAlertEmailRow, siteUrl: string): Email {
  const first = (row.name ?? "").split(" ")[0] || "there";
  const who = names(row.regulars);
  const are = row.regulars.length === 1 ? "is" : "are";
  const venue = row.venue ?? "the pitch";
  const game = row.title ? `${row.title} · ${venue}` : venue;
  const kickoff = when(row.kickoff_at);
  const spots = `${row.spots_left} spot${row.spots_left === 1 ? "" : "s"} left`;
  const link = `${siteUrl}/m/${encodeURIComponent(row.share_slug)}`;
  const settings = `${siteUrl}/profile/edit`;

  const subject = `${who} ${are} playing ${kickoff}`;
  const lead = `${who} (your regular${row.regulars.length === 1 ? "" : "s"}) ${are} in. ${spots}.`;
  const footer = "You get this because you added them as a regular on 5sFindr. Turn these emails off on your profile:";

  const text = [
    `Hi ${first},`,
    "",
    lead,
    "",
    game,
    kickoff,
    "",
    `I'm in: ${link}`,
    "",
    `${footer} ${settings}`,
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
  <a href="${escapeHtml(link)}" style="display:block;text-align:center;background:#22c55e;color:#0b0f0c;font-weight:800;text-decoration:none;padding:14px;border-radius:14px">I'm in</a>
  <p style="margin:28px 0 0;font-size:12px;color:#6b7a72">${escapeHtml(footer)} <a href="${escapeHtml(settings)}" style="color:#9aa8a1">your profile</a>.</p>
</div></body></html>`;

  return { to: row.email, subject, html, text };
}
