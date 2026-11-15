import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig, Easing } from "remotion";
import { C, F } from "../brand";
import type { MockGame, Screen } from "../types";

// MOCKED SCREENS. They copy the markup, classes and copy of the real components
// (src/components/feed/MatchCard.tsx, src/app/m/[slug]/page.tsx, src/components/ui/Avatar.tsx)
// with fictional names and public venues from supabase/seed.sql. They show the planned
// post-S2 copy ("Claim your spot", no token/Premium lines). Replace with screen recordings
// from the demo Supabase project once S1 sets it up.

const W = 390; // the app's CSS width; the screen is scaled to fit the phone

// zoom > 1 shows the app slightly "zoomed in" so the UI stays legible in a 9:16 feed.
export const PhoneFrame: React.FC<{ width?: number; children: React.ReactNode; tilt?: number; zoom?: number }> = ({
  width = 620,
  children,
  tilt = 0,
  zoom = 1,
}) => {
  const h = width * 2.05;
  const pad = width * 0.035;
  const innerW = width - pad * 2;
  const scale = (innerW / W) * zoom;
  return (
    <div
      style={{
        width,
        height: h,
        borderRadius: width * 0.14,
        background: "linear-gradient(145deg,#2a312d,#0b0f0d 40%,#1a201c)",
        padding: pad,
        boxShadow: `0 40px 120px rgba(0,0,0,0.7), 0 0 0 2px #2b332f, 0 0 90px -30px ${C.pitch}55`,
        transform: `perspective(2000px) rotateY(${tilt}deg)`,
      }}
    >
      <div
        style={{
          width: innerW,
          height: h - pad * 2,
          borderRadius: width * 0.115,
          overflow: "hidden",
          background: C.ink900,
          position: "relative",
        }}
      >
        <div style={{ width: innerW / scale, height: (h - pad * 2) / scale, transform: `scale(${scale})`, transformOrigin: "0 0" }}>
          <StatusBar />
          {children}
        </div>
      </div>
    </div>
  );
};

// Just the screen content at a given pixel size (used for corner-pin composites).
export const BareScreen: React.FC<{ width: number; height: number; s: Screen; dur: number }> = ({ width, height, s, dur }) => {
  const scale = width / W;
  return (
    <div style={{ width, height, overflow: "hidden", background: C.ink900 }}>
      <div style={{ width: W, height: height / scale, transform: `scale(${scale})`, transformOrigin: "0 0" }}>
        <StatusBar />
        <ScreenView s={s} dur={dur} />
      </div>
    </div>
  );
};

const StatusBar: React.FC = () => (
  <div
    style={{
      height: 44,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "0 26px",
      fontFamily: F.body,
      fontWeight: 700,
      fontSize: 14,
      color: C.white,
    }}
  >
    <span>17:02</span>
    <span style={{ width: 90, height: 24, background: "#000", borderRadius: 20 }} />
    <span style={{ fontSize: 12, opacity: 0.8 }}>5G ▮▮▮</span>
  </div>
);

const AppHeader: React.FC = () => (
  <div style={{ textAlign: "center", padding: "6px 0 10px", fontFamily: F.body, fontWeight: 800, fontSize: 18, color: C.white }}>
    5s<span style={{ color: C.pitch }}>Findr</span>
  </div>
);

export const ScreenView: React.FC<{ s: Screen; dur: number }> = ({ s, dur }) => {
  switch (s.screen) {
    case "feed":
      return <FeedScreen heading={s.heading} games={s.games} />;
    case "invite":
      return <InviteScreen {...s} dur={dur} />;
    case "fill":
      return <FillScreen {...s} dur={dur} />;
    case "chat":
      return <ChatScreen {...s} dur={dur} />;
  }
};

// ---------- feed ----------
const MatchCardMock: React.FC<{ g: MockGame }> = ({ g }) => {
  const full = g.taken >= g.max;
  const left = Math.max(0, g.max - g.taken);
  const chip = (bg: string, color: string, text: string) => (
    <span style={{ borderRadius: 99, background: bg, color, padding: "2px 8px", fontWeight: 500 }}>{text}</span>
  );
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        borderRadius: 16,
        border: `1px solid ${C.ink700}`,
        background: "rgba(14,20,17,0.6)",
        padding: 16,
        fontFamily: F.body,
        color: C.white,
      }}
    >
      <div style={{ width: 56, textAlign: "center", flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", color: "rgba(255,255,255,0.4)" }}>{g.day}</div>
        <div style={{ fontSize: 18, fontWeight: 900, color: C.pitch, lineHeight: 1.15 }}>{g.time}</div>
      </div>
      <div style={{ width: 1, height: 40, background: C.ink700 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.title}</div>
        <div style={{ marginTop: 4, display: "flex", gap: 6, fontSize: 11, flexWrap: "wrap" }}>
          {chip(C.ink700, "rgba(255,255,255,0.6)", g.court ? "Court" : "Open field")}
          {chip("rgba(10,233,138,0.15)", C.pitch, "Instant")}
          {g.court && g.price ? chip(C.ink700, "rgba(255,255,255,0.6)", `R${g.price}pp`) : null}
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: full ? "#f87171" : C.white }}>
          {g.taken}/{g.max}
        </div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{full ? "full" : `${left} left`}</div>
      </div>
    </div>
  );
};

const FeedScreen: React.FC<{ heading?: string; games: MockGame[] }> = ({ heading, games }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ padding: "0 16px" }}>
      <AppHeader />
      <div style={{ fontFamily: F.body, fontWeight: 900, fontSize: 24, letterSpacing: "-0.02em", color: C.white, margin: "8px 4px 2px" }}>
        {heading ?? "Tonight near you"}
      </div>
      <div style={{ fontFamily: F.body, fontSize: 13, color: "rgba(255,255,255,0.5)", margin: "0 4px 14px" }}>
        {games.filter((g) => g.taken < g.max).length} games with open spots
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {games.map((g, i) => {
          const p = spring({ frame: frame - 6 - i * 5, fps, config: { damping: 18 } });
          return (
            <div key={i} style={{ opacity: p, transform: `translateY(${(1 - p) * 30}px)` }}>
              <MatchCardMock g={g} />
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ---------- invite ----------
const Row: React.FC<{ k: string; v: string }> = ({ k, v }) => (
  <div style={{ display: "flex", justifyContent: "space-between", borderTop: `1px solid ${C.ink700}`, paddingTop: 8, marginTop: 8 }}>
    <span style={{ color: "rgba(255,255,255,0.4)" }}>{k}</span>
    <span style={{ fontWeight: 600 }}>{v}</span>
  </div>
);

const InviteScreen: React.FC<{
  organiser: string;
  venue: string;
  area: string;
  kickoff: string;
  court: boolean;
  claimAt?: number;
  dur: number;
}> = ({ organiser, venue, area, kickoff, court, claimAt = 0.55, dur }) => {
  const frame = useCurrentFrame();
  const at = Math.round(dur * claimAt);
  const press = interpolate(frame, [at - 4, at, at + 4], [1, 0.94, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const done = frame >= at;
  const ripple = interpolate(frame, [at, at + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ padding: "0 24px", fontFamily: F.body, color: C.white }}>
      <AppHeader />
      <div
        style={{
          marginTop: 24,
          borderRadius: 24,
          border: "1px solid rgba(10,233,138,0.3)",
          background: "linear-gradient(180deg, rgba(10,233,138,0.10), transparent)",
          padding: 24,
          fontSize: 14,
        }}
      >
        <span
          style={{
            display: "inline-flex",
            borderRadius: 99,
            border: "1px solid rgba(10,233,138,0.3)",
            background: "rgba(10,233,138,0.1)",
            padding: "4px 12px",
            fontSize: 12,
            fontWeight: 600,
            color: C.pitch,
          }}
        >
          ⚽ 5-a-side invite
        </span>
        <div style={{ marginTop: 16, fontSize: 24, fontWeight: 900, lineHeight: 1.15 }}>{organiser} needs players</div>
        <div style={{ marginTop: 4, color: "rgba(255,255,255,0.6)" }}>
          5-a-side at <b style={{ color: C.white }}>{venue}</b> · {area}
        </div>
        <div style={{ marginTop: 20 }}>
          <Row k="Kickoff" v={kickoff} />
          <Row k="Venue" v={court ? "Official court" : "Open field"} />
          <Row k="Joining" v="Instant booking" />
        </div>
      </div>
      <div
        style={{
          position: "relative",
          marginTop: 24,
          borderRadius: 16,
          background: done ? C.ink800 : C.pitch,
          border: done ? `1px solid ${C.pitch}` : "1px solid transparent",
          color: done ? C.pitch : C.ink900,
          padding: "16px 0",
          textAlign: "center",
          fontWeight: 700,
          fontSize: 16,
          boxShadow: done ? "none" : "0 0 24px -4px #0AE98A66",
          transform: `scale(${press})`,
          overflow: "hidden",
        }}
      >
        {done ? "You're in ✓" : "Claim your spot"}
        {done && (
          <span
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: 400 * ripple,
              height: 400 * ripple,
              marginLeft: -200 * ripple,
              marginTop: -200 * ripple,
              borderRadius: 999,
              background: C.pitch,
              opacity: 0.25 * (1 - ripple),
            }}
          />
        )}
      </div>
    </div>
  );
};

// ---------- fill: roster filling up ----------
const Avatar: React.FC<{ name: string; size?: number }> = ({ name, size = 34 }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: 99,
      background: C.ink700,
      display: "grid",
      placeItems: "center",
      fontWeight: 900,
      color: C.pitch,
      fontSize: size * 0.45,
      flexShrink: 0,
    }}
  >
    {name.charAt(0).toUpperCase()}
  </div>
);

const FillScreen: React.FC<{
  title: string;
  kickoff: string;
  max: number;
  startTaken: number;
  names: string[];
  endLabel?: string;
  dur: number;
}> = ({ title, kickoff, max, startTaken, names, endLabel = "GAME ON", dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const toAdd = Math.max(0, max - startTaken);
  const t0 = dur * 0.15;
  const t1 = dur * 0.72;
  const added = Math.floor(
    interpolate(frame, [t0, t1], [0, toAdd + 0.999], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.quad),
    }),
  );
  const taken = Math.min(max, startTaken + added);
  const full = taken >= max;
  const roster = names.slice(0, taken);
  return (
    <div style={{ padding: "0 18px", fontFamily: F.body, color: C.white }}>
      <AppHeader />
      <div style={{ borderRadius: 24, border: `1px solid ${C.ink700}`, background: "rgba(14,20,17,0.6)", padding: 20 }}>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {kickoff}
        </div>
        <div style={{ fontSize: 22, fontWeight: 900, marginTop: 4 }}>{title}</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 14 }}>
          <span style={{ fontSize: 48, fontWeight: 900, color: full ? C.pitch : C.white, fontVariantNumeric: "tabular-nums" }}>
            {taken}/{max}
          </span>
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>{full ? "full" : `${max - taken} spots left`}</span>
        </div>
        <div style={{ height: 6, borderRadius: 9, background: C.ink700, marginTop: 10, overflow: "hidden" }}>
          <div style={{ width: `${(taken / max) * 100}%`, height: "100%", background: C.pitch, boxShadow: `0 0 12px ${C.pitch}` }} />
        </div>
      </div>
      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 6 }}>
        {roster.map((n, i) => {
          const isNew = i >= startTaken;
          const appear = t0 + ((i - startTaken + 1) / (toAdd + 0.999)) * (t1 - t0);
          const p = isNew ? Math.min(1, spring({ frame: frame - appear, fps, config: { damping: 16 } })) : 1;
          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "5px 10px",
                borderRadius: 12,
                background: isNew ? "rgba(10,233,138,0.08)" : "transparent",
                opacity: p,
                transform: `translateX(${(1 - p) * 40}px)`,
                fontSize: 14,
              }}
            >
              <span style={{ width: 18, color: "rgba(255,255,255,0.35)", fontSize: 12 }}>{i + 1}.</span>
              <Avatar name={n} size={28} />
              <span style={{ fontWeight: 600 }}>{n}</span>
              {isNew && <span style={{ marginLeft: "auto", fontSize: 11, color: C.pitch, fontWeight: 600 }}>joined via link</span>}
            </div>
          );
        })}
      </div>
      {full && (
        <div
          style={{
            marginTop: 12,
            textAlign: "center",
            borderRadius: 16,
            background: C.pitch,
            color: C.ink900,
            fontWeight: 900,
            padding: "12px 0",
            fontSize: 16,
            letterSpacing: "0.04em",
          }}
        >
          {endLabel}
        </div>
      )}
    </div>
  );
};

// ---------- chat: generic group-chat chaos (deliberately no WhatsApp branding) ----------
const ChatScreen: React.FC<{ group: string; messages: { from: string; text: string; me?: boolean }[]; dur: number }> = ({
  group,
  messages,
  dur,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const step = (dur * 0.85) / Math.max(1, messages.length);
  const shownIdx = messages.map((_, i) => i).filter((i) => frame >= i * step);
  const visible = shownIdx.slice(-10);
  const colours = ["#f0a35e", "#7cc5ff", "#e58bd0", "#ffd166"];
  return (
    <div style={{ fontFamily: F.body, color: C.white, height: "100%", background: "#0b0e0d" }}>
      <div style={{ padding: "8px 16px 12px", borderBottom: `1px solid ${C.ink700}`, display: "flex", gap: 10, alignItems: "center" }}>
        <Avatar name={group} size={34} />
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{group}</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>38 members · typing…</div>
        </div>
      </div>
      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        {visible.map((i) => {
          const m = messages[i];
          const p = spring({ frame: frame - i * step, fps, config: { damping: 15 } });
          return (
            <div
              key={i}
              style={{
                alignSelf: m.me ? "flex-end" : "flex-start",
                maxWidth: "78%",
                background: m.me ? "#1f3a2e" : C.ink700,
                borderRadius: 14,
                padding: "7px 11px",
                fontSize: 14,
                transform: `scale(${0.85 + 0.15 * Math.min(1, p)})`,
                opacity: Math.min(1, p),
                transformOrigin: m.me ? "right bottom" : "left bottom",
              }}
            >
              {!m.me && <div style={{ fontSize: 11, fontWeight: 700, color: colours[i % 4] }}>{m.from}</div>}
              {m.text}
            </div>
          );
        })}
      </div>
    </div>
  );
};
