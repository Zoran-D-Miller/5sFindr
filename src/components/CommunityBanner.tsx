// Premium WhatsApp community CTA. Hardcoded invite link.
const COMMUNITY_URL = "https://chat.whatsapp.com/BGUOFLNzLcGDauQtAiJo1I?mode=gi_t";

export function CommunityBanner() {
  return (
    <a
      href={COMMUNITY_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-2xl border border-pitch/30 bg-gradient-to-r from-pitch/15 to-transparent p-4 transition hover:border-pitch/60"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-pitch/15 text-xl">💬</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-white">Join the 5sFindr WhatsApp Community</span>
        <span className="block text-xs text-white/50">Match alerts, banter & last-minute spots</span>
      </span>
      <span className="shrink-0 text-sm font-bold text-pitch">Join →</span>
    </a>
  );
}
