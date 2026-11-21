import React from "react";
import { AbsoluteFill, random, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "../brand";

// Night pitch under floodlights: dark base, two cool light cones from the top,
// faint perspective pitch lines, vignette and animated film grain.
export const Atmosphere: React.FC<{ grain?: number; lines?: boolean; intensity?: number; still?: boolean }> = ({
  grain = 0.1,
  lines = true,
  intensity = 1,
  still = false,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  // floodlight flicker: tiny and slow, never strobing
  const flicker = still ? 1 : 0.95 + 0.05 * Math.sin(frame / 23) * random(`f${Math.floor(frame / 9)}`);
  const a = 0.22 * intensity * flicker;

  return (
    <AbsoluteFill style={{ backgroundColor: C.ink900, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 55% 38% at 8% -4%, rgba(234,242,255,${a}) 0%, transparent 70%),
                       radial-gradient(ellipse 55% 38% at 92% -4%, rgba(234,242,255,${a}) 0%, transparent 70%),
                       radial-gradient(ellipse 80% 40% at 50% 112%, rgba(10,233,138,${0.07 * intensity}) 0%, transparent 70%)`,
        }}
      />
      {[0, 1].map((i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            top: -height * 0.05,
            left: i === 0 ? -width * 0.25 : width * 0.35,
            width: width * 0.9,
            height: height * 0.95,
            background: `linear-gradient(${i === 0 ? 160 : 200}deg, rgba(234,242,255,${0.09 * intensity * flicker}) 0%, transparent 62%)`,
            clipPath: i === 0 ? "polygon(20% 0, 34% 0, 100% 100%, 40% 100%)" : "polygon(66% 0, 80% 0, 60% 100%, 0 100%)",
            filter: "blur(18px)",
          }}
        />
      ))}
      {lines && <PitchLines />}
      <AbsoluteFill
        style={{ background: "radial-gradient(ellipse 85% 75% at 50% 45%, transparent 55%, rgba(0,0,0,0.75) 100%)" }}
      />
      <Grain amount={grain} still={still} />
    </AbsoluteFill>
  );
};

const PitchLines: React.FC = () => {
  const { width, height } = useVideoConfig();
  return (
    <div
      style={{
        position: "absolute",
        left: -width * 0.2,
        width: width * 1.4,
        top: height * 0.58,
        height: height * 0.7,
        perspective: 900,
        opacity: 0.16,
      }}
    >
      <svg viewBox="0 0 1000 700" width="100%" height="100%" style={{ transform: "rotateX(62deg)", transformOrigin: "50% 0%" }}>
        <g fill="none" stroke={C.white} strokeWidth={4}>
          <rect x={60} y={20} width={880} height={660} />
          <line x1={500} y1={20} x2={500} y2={680} />
          <circle cx={500} cy={350} r={90} />
          <rect x={60} y={230} width={110} height={240} />
          <rect x={830} y={230} width={110} height={240} />
        </g>
      </svg>
    </div>
  );
};

// Film grain: SVG turbulence at half resolution, reseeded every 2 frames.
export const Grain: React.FC<{ amount?: number; still?: boolean }> = ({ amount = 0.1, still = false }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const seed = still ? 3 : Math.floor(frame / 2) % 12;
  const id = `grain-${seed}`;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width / 2} ${height / 2}`}
      preserveAspectRatio="none"
      style={{ position: "absolute", inset: 0, opacity: amount, mixBlendMode: "screen", pointerEvents: "none" }}
    >
      <filter id={id}>
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={seed} stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter={`url(#${id})`} />
    </svg>
  );
};
