import React from "react";
import {
  AbsoluteFill,
  Audio,
  CalculateMetadataFunction,
  OffthreadVideo,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { C, F, PLAIN_LINE, SAFE_9x16 } from "../brand";
import { Atmosphere, Grain } from "../components/Atmosphere";
import { CoordTag, Disclosure, PlainLine } from "../components/Brandmarks";
import { Captions } from "../components/Captions";
import { EndCard } from "../components/EndCard";
import { BareScreen, PhoneFrame, ScreenView } from "../components/Phone";
import type { CinematicProps, Shot } from "../types";
import { cornerPinMatrix, cornersAt } from "./homography";

// The Remotion edit for AI cinematic shorts.
// Clips are generated at 9:16 (1080x1920). A 1080x1920 "stage" holds the clip and
// any real-UI corner pin; the stage is then cover-fitted to 9:16, 4:5 or 1:1, so a
// pin keyed once works in every export. Titles, captions, the plain line and the
// AI disclosure are laid out per aspect, outside the stage.
export const CINE_FPS = 30;
const END_SEC = 2.8;
const SIZES = { "9:16": [1080, 1920], "4:5": [1080, 1350], "1:1": [1080, 1080] } as const;

// Files that aren't there yet (clips not generated, VO not recorded) are dropped, so a
// concept renders with labelled placeholders until Zoran drops files into clips/ and vo/.
const exists = async (p?: string | null) => {
  if (!p) return false;
  try {
    const r = await fetch(staticFile(p), { method: "HEAD" });
    return r.ok;
  } catch {
    return false;
  }
};

export const calculateCinematicMetadata: CalculateMetadataFunction<CinematicProps> = async ({ props }) => {
  const [width, height] = SIZES[props.aspect];
  const shots = await Promise.all(props.shots.map(async (s) => ({ ...s, src: (await exists(s.src)) ? s.src : undefined })));
  const vo = (await exists(props.vo)) ? props.vo : undefined;
  const bed = (await exists(props.bed)) ? props.bed : undefined;
  const sec = shots.reduce((a, s) => a + s.sec, 0) + END_SEC;
  return { width, height, durationInFrames: Math.round(sec * CINE_FPS), props: { ...props, shots, vo, bed } };
};

export const Cinematic: React.FC<CinematicProps> = (p) => {
  const { width, height } = useVideoConfig();
  let at = 0;
  const seqs = p.shots.map((s) => {
    const from = at;
    const d = Math.round(s.sec * CINE_FPS);
    at += d;
    return { from, durationInFrames: d };
  });
  const scale = Math.max(width / 1080, height / 1920);
  const u = height / 1920 < 0.75 ? 1.25 : 1; // text a bit larger on short frames

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {p.shots.map((s, i) => (
        <Sequence key={i} {...seqs[i]} name={s.label}>
          <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            <div style={{ width: 1080, height: 1920, transform: `scale(${scale})`, flexShrink: 0, position: "relative" }}>
              <ShotStage shot={s} dur={seqs[i].durationInFrames} />
            </div>
          </AbsoluteFill>
          <Grain amount={0.13} />
          <Letterbox />
          {s.title && <Title text={s.title} u={u} />}
          {s.caption && <Captions text={s.caption} dur={seqs[i].durationInFrames} bottom={height * 0.2} size={54 * u} />}
        </Sequence>
      ))}
      <Sequence from={at} durationInFrames={Math.round(END_SEC * CINE_FPS)} name="end card">
        <EndCard coord={p.coord} />
      </Sequence>
      {/* persistent: two-line rule + AI disclosure */}
      {/* 9:16 sits above the TikTok/Reels caption UI; 4:5 and 1:1 feeds have no overlay at the bottom */}
      <div style={{ position: "absolute", left: 70 * u, right: 150, bottom: p.aspect === "9:16" ? SAFE_9x16.bottom : height * 0.075, display: "flex", flexDirection: "column", gap: 14 }}>
        <PlainLine text={p.plainLine ?? PLAIN_LINE} size={(p.aspect === "9:16" ? 34 : 30) * u} />
        <div style={{ display: "flex" }}>
          <Disclosure text={p.disclosure ?? "AI-generated scenes · real app screens"} size={20 * u} />
        </div>
      </div>
      {p.coord && (
        <div style={{ position: "absolute", top: height * 0.1, left: 70 * u }}>
          <CoordTag text={p.coord} size={24 * u} />
        </div>
      )}
      {p.vo && <Audio src={staticFile(p.vo)} />}
      {p.bed && <Audio src={staticFile(p.bed)} volume={0.3} />}
    </AbsoluteFill>
  );
};

const ShotStage: React.FC<{ shot: Shot; dur: number }> = ({ shot, dur }) => {
  const frame = useCurrentFrame();
  if (shot.insert) {
    // full-frame real-UI insert: the phone in macro, matched to the night grade
    return (
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <Atmosphere intensity={0.6} lines={false} grain={0} />
        <div style={{ transform: `scale(${1.25 + frame * 0.0015}) rotate(-4deg)` }}>
          <PhoneFrame width={560}>
            <ScreenView s={shot.insert} dur={dur} />
          </PhoneFrame>
        </div>
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill>
      {shot.src ? (
        <OffthreadVideo src={staticFile(shot.src)} muted style={{ width: 1080, height: 1920, objectFit: "cover" }} />
      ) : (
        <Slate label={shot.label} />
      )}
      {shot.pin && <Pinned pin={shot.pin} dur={dur} />}
      {/* night grade */}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 90% 70% at 50% 45%, transparent 50%, rgba(0,0,0,0.7) 100%)" }} />
    </AbsoluteFill>
  );
};

// Real UI corner-pinned onto the phone in the clip, with a screen glow so it sits in the shot.
const Pinned: React.FC<{ pin: NonNullable<Shot["pin"]>; dur: number }> = ({ pin, dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sw = 390;
  const sh = 844;
  const corners = cornersAt(pin.keys, frame / fps);
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: sw,
        height: sh,
        transformOrigin: "0 0",
        transform: cornerPinMatrix(sw, sh, corners),
        filter: "brightness(1.05) contrast(1.05)",
        boxShadow: `0 0 80px 10px ${C.pitch}22`,
        borderRadius: 34,
        overflow: "hidden",
      }}
    >
      <BareScreen width={sw} height={sh} s={pin.screen} dur={dur} />
    </div>
  );
};

const Slate: React.FC<{ label: string }> = ({ label }) => (
  <AbsoluteFill>
    <Atmosphere intensity={0.9} grain={0} />
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontFamily: F.mono, fontSize: 34, color: C.dim, textAlign: "center", lineHeight: 1.6, border: `2px dashed ${C.ink600}`, padding: 40, borderRadius: 24 }}>
        PLACEHOLDER · GENERATE THIS SHOT
        <br />
        <span style={{ color: C.white }}>{label}</span>
      </div>
    </AbsoluteFill>
  </AbsoluteFill>
);

const Letterbox: React.FC = () => {
  const { height } = useVideoConfig();
  const bar = height * 0.035;
  return (
    <>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: bar, background: "#000" }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: bar, background: "#000" }} />
    </>
  );
};

const Title: React.FC<{ text: string; u: number }> = ({ text, u }) => {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();
  const o = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" });
  return (
    <div
      style={{
        position: "absolute",
        top: height * 0.36,
        left: 70 * u,
        right: 150,
        fontFamily: F.display,
        fontSize: 120 * u,
        lineHeight: 0.98,
        textTransform: "uppercase",
        color: C.white,
        opacity: o,
        letterSpacing: `${(1 - o) * 0.2}em`,
        textShadow: "0 6px 40px rgba(0,0,0,0.8)",
      }}
    >
      {text.split("\n").map((l, i) => (
        <div key={i}>{l}</div>
      ))}
    </div>
  );
};
