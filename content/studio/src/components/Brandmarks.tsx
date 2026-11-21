import React from "react";
import { C, F } from "../brand";

// Map pin + ball, redrawn from Waitlist/images/5sfindr logo 2.png for dark backgrounds.
export const PinLogo: React.FC<{ size?: number; glow?: boolean }> = ({ size = 120, glow = true }) => (
  <svg width={size} height={size * 1.35} viewBox="0 0 200 270" style={{ overflow: "visible" }}>
    {glow && (
      <defs>
        <filter id="pinglow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="10" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
    )}
    <g filter={glow ? "url(#pinglow)" : undefined}>
      <path d="M100 0C155 0 200 45 200 100C200 160 132 215 100 270C68 215 0 160 0 100C0 45 45 0 100 0Z" fill={C.pitch} />
      <circle cx={100} cy={100} r={66} fill={C.ink900} />
      <circle cx={100} cy={100} r={56} fill={C.white} />
      <g fill={C.ink900}>
        <polygon points="100,80 119,94 112,116 88,116 81,94" />
        <polygon points="100,44 116,50 112,64 88,64 84,50" />
        <polygon points="146,92 156,108 150,128 136,122 134,100" />
        <polygon points="54,92 44,108 50,128 64,122 66,100" />
        <polygon points="78,140 90,128 110,128 122,140 112,154 88,154" />
      </g>
    </g>
  </svg>
);

export const Wordmark: React.FC<{ size?: number; color?: string }> = ({ size = 64, color = C.white }) => (
  <span style={{ fontFamily: F.body, fontWeight: 900, fontSize: size, letterSpacing: "-0.03em", color }}>
    5s<span style={{ color: C.pitch }}>Findr</span>
  </span>
);

// "33.902° S, 18.409° E · THU 19:00"
export const CoordTag: React.FC<{ text: string; size?: number; color?: string; dot?: boolean }> = ({
  text,
  size = 26,
  color = C.dim,
  dot = true,
}) => (
  <div
    style={{
      fontFamily: F.mono,
      fontWeight: 500,
      fontSize: size,
      letterSpacing: "0.08em",
      color,
      textTransform: "uppercase",
      display: "flex",
      alignItems: "center",
      gap: size * 0.5,
    }}
  >
    {dot && (
      <span
        style={{
          width: size * 0.42,
          height: size * 0.42,
          borderRadius: 99,
          background: C.pitch,
          boxShadow: `0 0 ${size * 0.6}px ${C.pitch}`,
          flexShrink: 0,
        }}
      />
    )}
    {text}
  </div>
);

// The plain second line of the two-line rule.
export const PlainLine: React.FC<{ text: string; size?: number }> = ({ text, size = 30 }) => (
  <div style={{ fontFamily: F.body, fontWeight: 600, fontSize: size, color: C.white, opacity: 0.86, lineHeight: 1.3 }}>
    {text}
  </div>
);

// "AI-generated scenes · real app" chip for cinematic shorts.
export const Disclosure: React.FC<{ text: string; size?: number }> = ({ text, size = 22 }) => (
  <div
    style={{
      fontFamily: F.mono,
      fontSize: size,
      color: C.dim,
      border: `1px solid ${C.ink600}`,
      background: "rgba(7,10,9,0.55)",
      padding: `${size * 0.3}px ${size * 0.6}px`,
      borderRadius: 999,
      letterSpacing: "0.04em",
    }}
  >
    {text}
  </div>
);

// Headlines are uppercase, but "5s" must never become "5S". Wrap it so it keeps its case.
export const keep5s = (text: string): React.ReactNode =>
  text.split(/(\b5s\b)/g).map((part, i) =>
    part === "5s" ? (
      <span key={i} style={{ textTransform: "none" }}>
        5s
      </span>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    ),
  );
