import React from "react";
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { C, F, HANDLES, PLAIN_LINE } from "../brand";
import { Atmosphere } from "./Atmosphere";
import { CoordTag, PinLogo, PlainLine, Wordmark } from "./Brandmarks";

// Brand end card. Works at 9:16, 4:5 and 1:1 (sizes follow the frame height).
export const EndCard: React.FC<{ line?: string; cta?: string; coord?: string }> = ({
  line = PLAIN_LINE,
  cta = "Join the list · 5sfindr.com",
  coord = "CAPE TOWN · 33.92° S, 18.42° E",
}) => {
  const frame = useCurrentFrame();
  const { fps, height, width } = useVideoConfig();
  const u = Math.min(height / 1920, width / 1080) * (height < 1500 ? 1.15 : 1);
  const drop = spring({ frame, fps, config: { damping: 11, stiffness: 140 } });
  const rest = spring({ frame: frame - 8, fps, config: { damping: 18 } });
  const glow = interpolate(frame, [0, 12], [1.6, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill>
      <Atmosphere intensity={0.8} lines={false} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 34 * u }}>
        <div style={{ transform: `translateY(${(1 - drop) * -220 * u}px) scale(${glow})`, opacity: Math.min(1, drop * 1.5) }}>
          <PinLogo size={150 * u} />
        </div>
        <div style={{ opacity: rest, transform: `translateY(${(1 - rest) * 30}px)`, textAlign: "center" }}>
          <Wordmark size={118 * u} />
          <div style={{ fontFamily: F.mono, fontSize: 26 * u, color: C.faint, letterSpacing: "0.18em", marginTop: 6 * u }}>
            SAID “FIVES FINDER”
          </div>
        </div>
        <div style={{ opacity: rest, textAlign: "center", maxWidth: 820 * u }}>
          <PlainLine text={line} size={38 * u} />
        </div>
        <div
          style={{
            opacity: rest,
            background: C.pitch,
            color: C.ink900,
            fontFamily: F.body,
            fontWeight: 800,
            fontSize: 36 * u,
            padding: `${20 * u}px ${42 * u}px`,
            borderRadius: 999,
            boxShadow: `0 0 50px -8px ${C.pitch}`,
          }}
        >
          {cta}
        </div>
        <div style={{ opacity: rest * 0.9, display: "flex", gap: 28 * u, fontFamily: F.mono, fontSize: 24 * u, color: C.dim }}>
          <span>TT {HANDLES.tiktok}</span>
          <span>IG {HANDLES.instagram}</span>
        </div>
      </AbsoluteFill>
      <div style={{ position: "absolute", top: 230 * u, width: "100%", display: "flex", justifyContent: "center", opacity: rest }}>
        <CoordTag text={coord} size={24 * u} />
      </div>
    </AbsoluteFill>
  );
};
