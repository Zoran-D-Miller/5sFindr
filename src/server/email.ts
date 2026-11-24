// Server-only email through Resend (free tier: 100 emails/day, 3,000/month).
// Never import this from a client component: it reads RESEND_API_KEY.
// No key set → nothing is sent (returns { ok: false, skipped: true }), so
// previews and local dev can't email anyone by accident.

const RESEND_URL = "https://api.resend.com";

export const EMAIL_FROM = process.env.EMAIL_FROM || "5sFindr <hello@5sfindr.com>";

export interface Email {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export type SendResult =
  | { ok: true; sent: number }
  | { ok: false; skipped?: true; error: string };

export function emailEnabled() {
  return !!process.env.RESEND_API_KEY;
}

/** Sends up to 100 emails in one Resend batch call. */
export async function sendEmails(emails: Email[]): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, skipped: true, error: "RESEND_API_KEY not set" };
  if (emails.length === 0) return { ok: true, sent: 0 };
  if (emails.length > 100) return { ok: false, error: "Resend batches hold at most 100 emails" };

  try {
    const res = await fetch(`${RESEND_URL}/emails/batch`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(emails.map((e) => ({ from: EMAIL_FROM, ...e }))),
    });
    if (!res.ok) return { ok: false, error: `Resend ${res.status}: ${(await res.text()).slice(0, 300)}` };
    return { ok: true, sent: emails.length };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
