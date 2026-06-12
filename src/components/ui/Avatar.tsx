import { foundingTier, FOUNDING_RING } from "@/lib/positions";

// Circular avatar with an optional gold/silver founding ring. Falls back to
// the player's initial when no image is set.
export function Avatar({
  name,
  url,
  size = 40,
  foundingNumber,
}: {
  name: string;
  url?: string | null;
  size?: number;
  foundingNumber?: number | null;
}) {
  const tier = foundingTier(foundingNumber);
  const ring = tier ? FOUNDING_RING[tier] : "";
  const dim = { width: size, height: size };

  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name}
        style={dim}
        className={`shrink-0 rounded-full object-cover ${ring}`}
      />
    );
  }
  return (
    <div
      style={dim}
      className={`grid shrink-0 place-items-center rounded-full bg-ink-700 font-black text-pitch ${ring}`}
    >
      {name.charAt(0).toUpperCase() || "?"}
    </div>
  );
}
