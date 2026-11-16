import React from "react";
import {
  AbsoluteFill,
  Audio,
  CalculateMetadataFunction,
  OffthreadVideo,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { getAudioDurationInSeconds } from "@remotion/media-utils";
import { C, F, SAFE_9x16 } from "../brand";
import { Atmosphere, Grain } from "../components/Atmosphere";
import { CoordTag, keep5s } from "../components/Brandmarks";
import { Captions } from "../components/Captions";
import { EndCard } from "../components/EndCard";
import { PhoneFrame, ScreenView } from "../components/Phone";
import type { ShortProps, Visual } from "../types";

// Vertical short, 1080x1920 @ 30fps.
//   hook (on screen from frame 0, readable as the thumbnail) → beats → end card.
// Each beat lasts max(minSec, voice line + 0.35s), so recorded voice lines never get cut.
export const FPS = 30;
const HOOK_SEC = 2.0;
const BEAT_SEC = 2.8;
const END_SEC = 3.0;

export type ShortRenderProps = ShortProps & { _frames?: number[]; _vo?: boolean[] };

const voLen = async (path?: string) => {
  if (!path) return 0;
  try {
    return await getAudioDurationInSeconds(staticFile(path));
  } catch {
    return 0; // missing file: fall back to minSec so drafts still render
  }
};

export const calculateShortMetadata: CalculateMetadataFunction<ShortRenderProps> = async ({ props }) => {
  // Voice lines that don't exist yet are skipped, so drafts render silent with captions.
  const lens = [await voLen(props.hook.vo), ...(await Promise.all(props.beats.map((b) => voLen(b.vo)))), await voLen(props.end?.vo)];
  const mins = [props.hook.minSec ?? HOOK_SEC, ...props.beats.map((b) => b.minSec ?? BEAT_SEC), END_SEC];
  const tails = [0.25, ...props.beats.map(() => 0.35), 0.4];
  const frames = mins.map((m, i) => Math.round(Math.max(m, lens[i] > 0 ? lens[i] + tails[i] : 0) * FPS));
  return { durationInFrames: frames.reduce((a, b) => a + b, 0), props: { ...props, _frames: frames, _vo: lens.map((l) => l > 0) } };
};

export const Short: React.FC<ShortRenderProps> = (props) => {
  const frames = props._frames ?? [HOOK_SEC * FPS, ...props.beats.map(() => BEAT_SEC * FPS), END_SEC * FPS];
  let at = 0;
  const seq = (i: number) => {
    const from = at;
    at += frames[i];
    return { from, durationInFrames: frames[i] };
  };
  const hookSeq = seq(0);
  const beatSeqs = props.beats.map((_, i) => seq(i + 1));
  const endSeq = seq(props.beats.length + 1);

  return (
    <AbsoluteFill style={{ backgroundColor: C.ink900 }}>
      <Atmosphere />
      <Sequence {...hookSeq} name="hook">
        <Hook text={props.hook.text} sub={props.hook.sub} coord={props.coord} />
        {props.hook.vo && props._vo?.[0] && <Audio src={staticFile(props.hook.vo)} />}
      </Sequence>
      {props.beats.map((b, i) => (
        <Sequence key={i} {...beatSeqs[i]} name={`beat ${i + 1}: ${b.visual.kind}`}>
          <BeatVisual v={b.visual} dur={beatSeqs[i].durationInFrames} />
          {b.caption && <Captions text={b.caption} dur={beatSeqs[i].durationInFrames} />}
          {b.vo && props._vo?.[i + 1] && <Audio src={staticFile(b.vo)} />}
        </Sequence>
      ))}
      <Sequence {...endSeq} name="end card">
        <EndCard line={props.end?.line} cta={props.end?.cta} />
        {props.end?.vo && props._vo?.[props.beats.length + 1] && <Audio src={staticFile(props.end.vo)} />}
      </Sequence>
      {props.bed && <Audio src={staticFile(props.bed)} volume={0.22} loop />}
      {props.aiVoice && props._vo?.some(Boolean) && <AiVoiceChip />}
    </AbsoluteFill>
  );
};

// Disclosure: the voiceover is synthetic (Kokoro). Top-right, inside the safe zone, on every frame
// except the hook's first 8 frames so the cover/thumbnail stays clean.
const AiVoiceChip: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: "absolute",
        top: SAFE_9x16.top + 18,
        right: SAFE_9x16.right,
        opacity: frame < 8 ? 0 : 0.8,
        fontFamily: F.mono,
        fontSize: 24,
        letterSpacing: "0.1em",
        color: C.dim,
        border: `1.5px solid ${C.dim}`,
        borderRadius: 8,
        padding: "6px 12px",
        textTransform: "uppercase",
      }}
    >
      AI voice
    </div>
  );
};

// ---------- hook: fully legible on frame 0 ----------
const Hook: React.FC<{ text: string; sub?: string; coord?: string }> = ({ text, sub, coord }) => {
  const frame = useCurrentFrame();
  const punch = interpolate(frame, [0, 8], [1.06, 1], { extrapolateRight: "clamp" });
  const lines = text.split("\n");
  const longest = Math.max(...lines.map((l) => l.replace(/\*/g, "").length));
  const size = Math.min(230, Math.round(1950 / Math.max(longest, 4)));
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", top: SAFE_9x16.top + 20, left: SAFE_9x16.left }}>
        <CoordTag text={coord ?? "CAPE TOWN · 33.92° S, 18.42° E"} />
      </div>
      <div
        style={{
          position: "absolute",
          top: 520,
          left: SAFE_9x16.left,
          right: SAFE_9x16.left,
          transform: `scale(${punch})`,
          transformOrigin: "50% 40%",
        }}
      >
        <div style={{ fontFamily: F.display, fontSize: size, lineHeight: 0.96, textTransform: "uppercase", color: C.white }}>
          {lines.map((l, i) => (
            <div key={i}>
              <Accent text={l} />
            </div>
          ))}
        </div>
        {sub && <div style={{ marginTop: 34, fontFamily: F.body, fontWeight: 700, fontSize: 46, color: C.dim, lineHeight: 1.25 }}>{sub}</div>}
      </div>
    </AbsoluteFill>
  );
};

const Accent: React.FC<{ text: string }> = ({ text }) => (
  <>
    {text.split(/(\*[^*]+\*)/g).map((p, i) =>
      p.startsWith("*") ? (
        <span key={i} style={{ color: C.pitch, textShadow: `0 0 40px ${C.pitch}66` }}>
          {p.slice(1, -1)}
        </span>
      ) : (
        <React.Fragment key={i}>{keep5s(p)}</React.Fragment>
      ),
    )}
  </>
);

// ---------- beat visuals ----------
const BeatVisual: React.FC<{ v: Visual; dur: number }> = ({ v, dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 18, stiffness: 160 } });

  switch (v.kind) {
    case "type": {
      const longest = Math.max(...v.lines.map((l) => l.replace(/\*/g, "").length));
      const size = Math.min(210, Math.round(1950 / Math.max(longest, 4)));
      return (
        <AbsoluteFill>
          <div style={{ position: "absolute", top: 470, left: SAFE_9x16.left, right: SAFE_9x16.left }}>
            {v.lines.map((l, i) => {
              const p = spring({ frame: frame - i * 5, fps, config: { damping: 16 } });
              return (
                <div
                  key={i}
                  style={{
                    fontFamily: F.display,
                    fontSize: size,
                    lineHeight: 0.98,
                    textTransform: "uppercase",
                    color: v.accent === i ? C.pitch : C.white,
                    opacity: Math.min(1, p),
                    transform: `translateY(${(1 - Math.min(1, p)) * 50}px)`,
                    clipPath: `inset(0 0 ${(1 - Math.min(1, p)) * 100}% 0)`,
                  }}
                >
                  <Accent text={l} />
                </div>
              );
            })}
            {v.small && (
              <div style={{ marginTop: 30, fontFamily: F.mono, fontSize: 32, color: C.dim, letterSpacing: "0.06em", opacity: enter }}>{v.small}</div>
            )}
          </div>
        </AbsoluteFill>
      );
    }
    case "phone": {
      const { kind, label, ...screen } = v;
      return (
        <AbsoluteFill style={{ alignItems: "center" }}>
          {label && (
            <div style={{ position: "absolute", top: SAFE_9x16.top + 10, left: SAFE_9x16.left, opacity: enter }}>
              <CoordTag text={label} />
            </div>
          )}
          <div style={{ position: "absolute", top: 270, transform: `translateY(${(1 - enter) * 260}px) scale(${0.94 + 0.06 * enter})` }}>
            <PhoneFrame width={580} zoom={1.12}>
              <ScreenView s={screen} dur={dur} />
            </PhoneFrame>
          </div>
        </AbsoluteFill>
      );
    }
    case "stat":
      return (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-start" }}>
          <div style={{ marginTop: 380, textAlign: "center", transform: `scale(${0.85 + 0.15 * enter})`, opacity: enter }}>
            <div style={{ fontFamily: F.stencil, fontWeight: 900, fontSize: 560, lineHeight: 0.8, color: C.white, textShadow: `0 0 80px ${C.pitch}44` }}>
              {v.big}
            </div>
            <div style={{ fontFamily: F.display, fontSize: 130, color: C.pitch, textTransform: "uppercase", marginTop: 10 }}>{v.label}</div>
            {v.small && <div style={{ fontFamily: F.mono, fontSize: 32, color: C.dim, marginTop: 20, letterSpacing: "0.08em" }}>{v.small}</div>}
          </div>
        </AbsoluteFill>
      );
    case "list":
      return (
        <AbsoluteFill>
          <div style={{ position: "absolute", top: 330, left: SAFE_9x16.left, right: SAFE_9x16.right }}>
            <div style={{ fontFamily: F.display, fontSize: 120, lineHeight: 1, textTransform: "uppercase", color: C.white, opacity: enter }}>
              <Accent text={v.title} />
            </div>
            <div style={{ marginTop: 44, display: "flex", flexDirection: "column", gap: 26 }}>
              {v.items.map((it, i) => {
                const start = (dur * 0.12) + (i * dur * 0.7) / v.items.length;
                const p = Math.min(1, spring({ frame: frame - start, fps, config: { damping: 16 } }));
                return (
                  <div key={i} style={{ display: "flex", gap: 26, alignItems: "baseline", opacity: p, transform: `translateX(${(1 - p) * 60}px)` }}>
                    <span style={{ fontFamily: F.stencil, fontWeight: 900, fontSize: 70, color: C.pitch, width: 90 }}>{String(i + 1).padStart(2, "0")}</span>
                    <span style={{ fontFamily: F.body, fontWeight: 800, fontSize: 56, color: C.white, lineHeight: 1.15 }}>{it}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </AbsoluteFill>
      );
    case "clip":
      return (
        <AbsoluteFill>
          <OffthreadVideo src={staticFile(v.src)} startFrom={v.startFrom} muted style={{ width: "100%", height: "100%", objectFit: "cover", filter: "contrast(1.08) saturate(0.75) brightness(0.8)" }} />
          <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(7,10,9,0.55) 0%, transparent 30%, transparent 55%, rgba(7,10,9,0.85) 100%)" }} />
          <Grain amount={0.12} />
          {v.label && (
            <div style={{ position: "absolute", top: SAFE_9x16.top + 10, left: SAFE_9x16.left }}>
              <CoordTag text={v.label} />
            </div>
          )}
        </AbsoluteFill>
      );
    case "map":
      return (
        <AbsoluteFill>
          <div style={{ position: "absolute", top: 360, left: SAFE_9x16.left, right: SAFE_9x16.right }}>
            {v.title && (
              <div style={{ fontFamily: F.display, fontSize: 118, lineHeight: 1, textTransform: "uppercase", color: C.white, marginBottom: 50, opacity: enter }}>
                <Accent text={v.title} />
              </div>
            )}
            {v.areas.map((a, i) => {
              const p = Math.min(1, spring({ frame: frame - 6 - i * 6, fps, config: { damping: 20 } }));
              const fill = interpolate(frame, [10 + i * 6, dur * 0.7], [0, a.now / a.goal], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              return (
                <div key={i} style={{ marginBottom: 44, opacity: p }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontFamily: F.mono, fontSize: 34, color: C.white, letterSpacing: "0.06em" }}>
                    <span>{a.name.toUpperCase()}</span>
                    <span style={{ color: C.pitch }}>
                      {Math.round(fill * a.goal)}/{a.goal}
                    </span>
                  </div>
                  <div style={{ height: 18, borderRadius: 9, background: C.ink700, marginTop: 14, overflow: "hidden" }}>
                    <div style={{ width: `${fill * 100}%`, height: "100%", background: C.pitch, boxShadow: `0 0 20px ${C.pitch}` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </AbsoluteFill>
      );
  }
};
