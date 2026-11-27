import { ImageResponse } from "next/og";
import { loadInvite, inviteWhen, spotsLabel } from "@/lib/invite";
import { labelList } from "@/lib/labels";

export const alt = "5sFindr game invite";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// WhatsApp / social link preview: who's playing, when, where, spots left.
export default async function Image({ params }: { params: { slug: string } }) {
  const m = await loadInvite(params.slug);
  const faces = (m?.players ?? []).slice(0, 7);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between",
          background: "#070A09", color: "white", padding: 64, fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 36, fontWeight: 800 }}>
          5s<span style={{ color: "#0AE98A" }}>Findr</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 64, fontWeight: 900, lineHeight: 1.05 }}>
            {m ? `${m.organizer?.name ?? "A game"} needs players` : "Find your next 5-a-side"}
          </div>
          {m && (
            <div style={{ marginTop: 18, fontSize: 34, color: "rgba(255,255,255,0.7)" }}>
              {`${inviteWhen(m.kickoff_at)} · ${m.location?.name ?? ""} · ${m.price_per_player_zar > 0 ? `R${m.price_per_player_zar} each` : "Free"}`}
            </div>
          )}
          {m && labelList(m).length > 0 && (
            <div style={{ marginTop: 14, display: "flex", fontSize: 30, fontWeight: 700, color: "#0AE98A" }}>
              {labelList(m).join(" · ")}
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex" }}>
            {faces.map((p, i) =>
              p.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={p.user_id}
                  src={p.avatar_url}
                  width={96}
                  height={96}
                  style={{ borderRadius: 48, border: "5px solid #070A09", marginLeft: i ? -22 : 0, objectFit: "cover" }}
                />
              ) : (
                <div
                  key={p.user_id}
                  style={{
                    width: 96, height: 96, borderRadius: 48, border: "5px solid #070A09", marginLeft: i ? -22 : 0,
                    background: "#1A211E", color: "#0AE98A", display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 42, fontWeight: 900,
                  }}
                >
                  {p.name.charAt(0).toUpperCase()}
                </div>
              ),
            )}
          </div>
          {m && (
            <div
              style={{
                display: "flex", background: "#0AE98A", color: "#070A09", borderRadius: 999, padding: "18px 36px",
                fontSize: 40, fontWeight: 900,
              }}
            >
              {spotsLabel(m)}
            </div>
          )}
        </div>
      </div>
    ),
    size,
  );
}
