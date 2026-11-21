import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, F, SAFE_9x16 } from "../brand";

// Burned-in captions, TikTok style: the line is split into chunks of up to
// `per` words, shown one chunk at a time, with the active word in pitch green.
// Timing is spread across the beat (longer words get more time). A voice line that
// runs long stretches its beat (see calculateShortMetadata in Short.tsx).
export const Captions: React.FC<{ text: string; dur: number; per?: number; bottom?: number; size?: number }> = ({
  text,
  dur,
  per = 4,
  bottom,
  size = 62,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return null;

  const weights = words.map((w) => 1 + w.replace(/[^\w]/g, "").length / 6);
  const total = weights.reduce((a, b) => a + b, 0);
  const usable = dur * 0.94;
  const starts: number[] = [];
  let acc = 0;
  for (const w of weights) {
    starts.push((acc / total) * usable);
    acc += w;
  }
  let active = 0;
  for (let i = 0; i < words.length; i++) if (frame >= starts[i]) active = i;
  const chunk = Math.floor(active / per);
  const chunkWords = words.slice(chunk * per, chunk * per + per);
  const pop = spring({ frame: frame - starts[chunk * per], fps, config: { damping: 14, stiffness: 220 } });

  return (
    <div
      style={{
        position: "absolute",
        left: SAFE_9x16.left,
        right: SAFE_9x16.right,
        bottom: bottom ?? SAFE_9x16.bottom + 10,
        display: "flex",
        justifyContent: "center",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontFamily: F.body,
          fontWeight: 900,
          fontSize: size,
          lineHeight: 1.12,
          letterSpacing: "-0.01em",
          color: C.white,
          textShadow: "0 4px 18px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,1)",
          transform: `scale(${0.9 + 0.1 * Math.min(1, pop)})`,
        }}
      >
        {chunkWords.map((w, i) => {
          const idx = chunk * per + i;
          return (
            <span key={idx} style={{ color: idx === active ? C.pitch : C.white, opacity: idx <= active ? 1 : 0.55 }}>
              {w}
              {i < chunkWords.length - 1 ? " " : ""}
            </span>
          );
        })}
      </div>
    </div>
  );
};
