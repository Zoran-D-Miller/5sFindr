// WhatsApp share text for a game. Laid out like the lists people already
// post in their groups:
//   ⚽ Thu 19:00 · Green Point Urban Park · R60 each
//   1. Zoran
//   2. Sam
//   3 spots left → https://5sfindr.com/m/abc123
function when(iso: string) {
  return new Date(iso).toLocaleString("en-ZA", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Africa/Johannesburg",
  });
}

export function buildGroupList(params: {
  title?: string | null;
  venue: string;
  kickoffIso: string;
  pricePerPlayer: number;
  names: string[]; // confirmed players, organiser first
  maxPlayers: number;
  shareSlug: string;
  siteUrl: string;
}): { text: string; whatsappUrl: string; link: string } {
  const link = `${params.siteUrl}/m/${params.shareSlug}`;
  const price = params.pricePerPlayer > 0 ? `R${params.pricePerPlayer} each` : "Free";
  const head = [params.title?.trim(), when(params.kickoffIso), params.venue, price].filter(Boolean).join(" · ");
  const list = params.names.slice(0, params.maxPlayers).map((n, i) => `${i + 1}. ${n}`);
  const left = Math.max(0, params.maxPlayers - params.names.length);
  const tail = left > 0 ? `${left} spot${left === 1 ? "" : "s"} left → ${link}` : `Full. Waiting list → ${link}`;
  const text = [`⚽ ${head}`, ...list, tail].join("\n");
  return { text, link, whatsappUrl: `https://wa.me/?text=${encodeURIComponent(text)}` };
}

// Short "need N more" blast for other groups.
export function buildPingBlast(params: {
  venue: string;
  kickoffIso: string;
  spotsLeft: number;
  shareSlug: string;
  siteUrl: string;
}): string {
  const need =
    params.spotsLeft > 0 ? `Need ${params.spotsLeft} more player${params.spotsLeft === 1 ? "" : "s"}` : "Game on";
  return `⚽ ${need}: ${when(params.kickoffIso)} at ${params.venue}.\nTap "I'm in" (free, no app needed):\n${params.siteUrl}/m/${params.shareSlug}`;
}
