import { ImageResponse } from "next/og";
import { cardWhen, loadRecap } from "@/server/cards";
import { labelList } from "@/lib/labels";

// Organiser's game recap card (S6), 1080×1350: fits an IG post, an IG story
// and WhatsApp. Completed games only (game_recap() returns null otherwise).
export const dynamic = "force-dynamic";

const GREEN = "#0AE98A";
const INK = "#070A09";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const r = await loadRecap(params.id);
  if (!r) return new Response("Not found", { status: 404 });

  const labels = labelList(r);
  const where = [r.venue, r.neighborhood].filter(Boolean).join(" · ").toUpperCase();
  const faces = r.faces.slice(0, 10);
  const host = (r.organizer_name ?? "").split(" ")[0];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between",
          background: INK, color: "white", padding: 80, fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", fontSize: 44, fontWeight: 800 }}>
            5s<span style={{ color: GREEN }}>Findr</span>
          </div>
          <div style={{ display: "flex", fontSize: 28, letterSpacing: 6, color: "rgba(255,255,255,0.5)" }}>GAME RECAP</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 30, letterSpacing: 4, color: GREEN }}>{cardWhen(r.kickoff_at)}</div>
          <div style={{ display: "flex", marginTop: 12, fontSize: 40, color: "rgba(255,255,255,0.75)" }}>{where}</div>
          {r.title && (
            <div style={{ display: "flex", marginTop: 8, fontSize: 36, color: "rgba(255,255,255,0.55)" }}>{r.title}</div>
          )}

          <div style={{ display: "flex", marginTop: 56, fontSize: 168, fontWeight: 900, lineHeight: 0.95 }}>
            {`${r.players} PLAYED`}
          </div>
          {r.new_faces > 0 && (
            <div style={{ display: "flex", marginTop: 12, fontSize: 96, fontWeight: 900, color: GREEN, lineHeight: 1 }}>
              {`${r.new_faces} NEW FACE${r.new_faces === 1 ? "" : "S"}`}
            </div>
          )}
          {r.first_game_ct > 0 && (
            <div style={{ display: "flex", marginTop: 20, fontSize: 36, color: "rgba(255,255,255,0.7)" }}>
              {`${r.first_game_ct} played their first game in Cape Town`}
            </div>
          )}
          {labels.length > 0 && (
            <div style={{ display: "flex", marginTop: 32 }}>
              {labels.map((l) => (
                <div
                  key={l}
                  style={{
                    display: "flex", marginRight: 16, padding: "10px 26px", borderRadius: 999,
                    border: `3px solid ${GREEN}`, color: GREEN, fontSize: 30, fontWeight: 700,
                  }}
                >
                  {l}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex" }}>
            {faces.map((f, i) =>
              f.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={f.avatar_url}
                  width={112}
                  height={112}
                  style={{ borderRadius: 56, border: `6px solid ${INK}`, marginLeft: i ? -28 : 0, objectFit: "cover" }}
                />
              ) : (
                <div
                  key={i}
                  style={{
                    width: 112, height: 112, borderRadius: 56, border: `6px solid ${INK}`, marginLeft: i ? -28 : 0,
                    background: "#1A211E", color: GREEN, display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 52, fontWeight: 900,
                  }}
                >
                  {f.name.charAt(0).toUpperCase()}
                </div>
              ),
            )}
          </div>
          <div style={{ display: "flex", marginTop: 40, fontSize: 32, color: "rgba(255,255,255,0.6)" }}>
            {host ? `Run by ${host} on 5sFindr` : "Run on 5sFindr"}
          </div>
          <div style={{ display: "flex", marginTop: 8, fontSize: 32, color: "rgba(255,255,255,0.45)" }}>
            Find or fill a 5-a-side game in Cape Town · 5sfindr.com
          </div>
        </div>
      </div>
    ),
    { width: 1080, height: 1350, headers: { "Cache-Control": "public, max-age=300, s-maxage=300" } },
  );
}
