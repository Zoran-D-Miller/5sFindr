import { ImageResponse } from "next/og";
import { loadPlayerCard } from "@/server/cards";
import { FOUNDING_LABEL, foundingNo, foundingTier, POSITION_BADGE } from "@/lib/positions";
import { showUp } from "@/lib/showUp";

// Player card for IG stories (S6), 1080×1920. Public profile data only.
export const dynamic = "force-dynamic";

const GREEN = "#0AE98A";
const INK = "#070A09";

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 280 }}>
      <div style={{ display: "flex", fontSize: 110, fontWeight: 900, lineHeight: 1 }}>{value}</div>
      <div style={{ display: "flex", marginTop: 14, fontSize: 30, letterSpacing: 3, color: "rgba(255,255,255,0.55)" }}>
        {label}
      </div>
    </div>
  );
}

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const p = await loadPlayerCard(params.slug);
  if (!p) return new Response("Not found", { status: 404 });

  const tier = foundingTier(p.founding_number);
  const rate = showUp(p.games_played, p.games_missed);
  const positions = (p.preferred_positions ?? []).filter((x) => x !== "ANY").map((x) => POSITION_BADGE[x]);
  const since = new Date(p.created_at).getFullYear();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "space-between", background: INK, color: "white", padding: "140px 80px 120px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 52, fontWeight: 800 }}>
          5s<span style={{ color: GREEN }}>Findr</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          {p.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={p.avatar_url}
              width={360}
              height={360}
              style={{ borderRadius: 180, border: `10px solid ${tier ? GREEN : "#1A211E"}`, objectFit: "cover" }}
            />
          ) : (
            <div
              style={{
                width: 360, height: 360, borderRadius: 180, border: `10px solid ${tier ? GREEN : "#1A211E"}`,
                background: "#1A211E", color: GREEN, display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 170, fontWeight: 900,
              }}
            >
              {p.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div style={{ display: "flex", marginTop: 56, fontSize: 120, fontWeight: 900, textAlign: "center", lineHeight: 1 }}>
            {p.name.toUpperCase()}
          </div>
          {tier && p.founding_number != null && (
            <div style={{ display: "flex", marginTop: 24, fontSize: 44, fontWeight: 800, color: GREEN, letterSpacing: 2 }}>
              {`${FOUNDING_LABEL[tier].toUpperCase()} ${foundingNo(p.founding_number)}`}
            </div>
          )}
          <div style={{ display: "flex", marginTop: 20, fontSize: 36, color: "rgba(255,255,255,0.6)" }}>
            {[p.neighborhood, positions.join(" / ") || null, `On 5sFindr since ${since}`].filter(Boolean).join(" · ")}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "center" }}>
          <Stat value={String(p.games_played)} label="GAMES" />
          <Stat value={rate.pct == null ? "NEW" : `${rate.pct}%`} label="SHOWS UP" />
          <Stat value={String(p.played_with)} label="PLAYED WITH" />
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 800 }}>Find a game: 5sfindr.com</div>
          <div style={{ display: "flex", marginTop: 10, fontSize: 32, color: "rgba(255,255,255,0.5)" }}>
            Find or fill a 5-a-side game in Cape Town
          </div>
        </div>
      </div>
    ),
    { width: 1080, height: 1920, headers: { "Cache-Control": "public, max-age=300, s-maxage=300" } },
  );
}
