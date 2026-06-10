import type { TokenStatus } from "@/lib/types";

// A single R20 commitment token, rendered as a coin. Color encodes its state.
const STYLES: Record<TokenStatus, string> = {
  available: "border-pitch text-pitch bg-pitch/10 shadow-glow",
  committed: "border-electric text-electric bg-electric/10",
  forfeited: "border-red-500/40 text-red-400/70 bg-ink-800 line-through",
  consumed: "border-ink-600 text-white/30 bg-ink-800",
};

export function TokenChip({
  status = "available",
  size = "md",
}: {
  status?: TokenStatus;
  size?: "sm" | "md";
}) {
  const dim = size === "sm" ? "h-9 w-9 text-[10px]" : "h-14 w-14 text-xs";
  return (
    <div
      className={`grid shrink-0 place-items-center rounded-full border-2 font-black ${dim} ${STYLES[status]}`}
      title={status}
    >
      R20
    </div>
  );
}
