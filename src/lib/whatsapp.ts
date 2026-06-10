// Builds the viral WhatsApp invite from a match's share_slug. Phase 7 wires
// this to a share button; defined now so the slug we generate is immediately
// usable. Matches the spec template.
export function buildWhatsAppInvite(params: {
  organizerName: string;
  position?: string; // e.g. "GK" — optional "needs a ___"
  venue: string;
  kickoffIso: string;
  shareSlug: string;
  siteUrl: string;
}): { text: string; whatsappUrl: string; link: string } {
  const time = new Date(params.kickoffIso).toLocaleString("en-ZA", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const role = params.position ? `a ${params.position}` : "players";
  const link = `${params.siteUrl}/m/${params.shareSlug}`;

  const text =
    `${params.organizerName} needs ${role} for a 5-a-side match at ${params.venue} (${time}). ` +
    `Click to claim the spot and get your first month free: ${link}`;

  return {
    text,
    link,
    whatsappUrl: `https://wa.me/?text=${encodeURIComponent(text)}`,
  };
}
