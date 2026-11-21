import React from "react";
import { AbsoluteFill } from "remotion";
import { C, F, HANDLES } from "../brand";
import { Atmosphere } from "../components/Atmosphere";
import { CoordTag, PinLogo, PlainLine, Wordmark, keep5s } from "../components/Brandmarks";
import type { CarouselProps, Slide } from "../types";

// One carousel slide at 1080x1350 (IG 4:5). The render script renders every index.
const PAD = 90;

export const Carousel: React.FC<CarouselProps> = ({ slides, index, coord }) => {
  const slide = slides[Math.min(index, slides.length - 1)];
  const n = slides.length;
  const isEdge = slide.kind === "cover" || slide.kind === "cta";
  return (
    <AbsoluteFill style={{ fontFamily: F.body, color: C.white }}>
      <Atmosphere still grain={0.09} intensity={slide.kind === "cover" ? 1.1 : 0.7} lines={slide.kind === "cover" || slide.kind === "stat"} />
      {/* header */}
      <div style={{ position: "absolute", top: 72, left: PAD, right: PAD, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <CoordTag text={coord ?? "CAPE TOWN · 33.92° S, 18.42° E"} size={22} />
        <div style={{ fontFamily: F.mono, fontSize: 22, color: C.faint, letterSpacing: "0.1em" }}>
          {String(index + 1).padStart(2, "0")}/{String(n).padStart(2, "0")}
        </div>
      </div>
      {/* body */}
      <div style={{ position: "absolute", top: 160, bottom: 170, left: PAD, right: PAD, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <SlideBody slide={slide} />
      </div>
      {/* footer: plain line on every slide (two-line rule) */}
      <div
        style={{
          position: "absolute",
          bottom: 64,
          left: PAD,
          right: PAD,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          borderTop: `1px solid ${C.ink600}`,
          paddingTop: 22,
        }}
      >
        <div>
          <Wordmark size={34} />
          <div style={{ fontSize: 20, color: C.dim, marginTop: 4 }}>Free 5-a-side games in Cape Town</div>
        </div>
        <div style={{ fontFamily: F.mono, fontSize: 20, color: C.dim, textAlign: "right" }}>
          {isEdge ? HANDLES.site : HANDLES.instagram}
          {index < n - 1 && <div style={{ color: C.pitch, marginTop: 4 }}>SWIPE →</div>}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const H: React.FC<{ children: React.ReactNode; size?: number; color?: string }> = ({ children, size = 150, color = C.white }) => (
  <div style={{ fontFamily: F.display, fontSize: size, lineHeight: 0.98, textTransform: "uppercase", color, letterSpacing: "0.005em" }}>
    {children}
  </div>
);

// Highlight *words* between asterisks in pitch green.
const Mark: React.FC<{ text: string }> = ({ text }) => (
  <>
    {text.split(/(\*[^*]+\*)/g).map((part, i) =>
      part.startsWith("*") ? (
        <span key={i} style={{ color: C.pitch }}>
          {part.slice(1, -1)}
        </span>
      ) : (
        <React.Fragment key={i}>{keep5s(part)}</React.Fragment>
      ),
    )}
  </>
);

const fit = (text: string, max: number, min: number, perChar: number) =>
  Math.max(min, Math.min(max, Math.round(perChar / Math.max(1, Math.max(...text.replace(/\*/g, "").split("\n").map((l) => l.length))))));

const SlideBody: React.FC<{ slide: Slide }> = ({ slide }) => {
  switch (slide.kind) {
    case "cover":
      return (
        <div>
          {slide.kicker && (
            <div style={{ fontFamily: F.mono, fontSize: 28, color: C.pitch, letterSpacing: "0.14em", marginBottom: 28 }}>{slide.kicker}</div>
          )}
          <H size={fit(slide.headline, 200, 110, 2000)}>
            {slide.headline.split("\n").map((l, i) => (
              <div key={i}>
                <Mark text={l} />
              </div>
            ))}
          </H>
          {slide.sub && (
            <div style={{ marginTop: 36, maxWidth: 820 }}>
              <PlainLine text={slide.sub} size={40} />
            </div>
          )}
        </div>
      );
    case "point":
      return (
        <div>
          <div style={{ fontFamily: F.stencil, fontWeight: 900, fontSize: 300, lineHeight: 0.8, color: C.pitch, opacity: 0.95 }}>{slide.n}</div>
          <div style={{ marginTop: 30 }}>
            <H size={fit(slide.title, 120, 76, 1500)}>
              <Mark text={slide.title} />
            </H>
          </div>
          <div style={{ marginTop: 28, fontSize: 40, lineHeight: 1.35, color: C.dim, maxWidth: 860 }}>
            <Mark text={slide.body} />
          </div>
        </div>
      );
    case "stat":
      return (
        <div>
          <div style={{ fontFamily: F.stencil, fontWeight: 900, fontSize: 420, lineHeight: 0.82, color: C.white }}>
            <Mark text={slide.big} />
          </div>
          <div style={{ marginTop: 20 }}>
            <H size={96} color={C.pitch}>
              {slide.label}
            </H>
          </div>
          {slide.body && <div style={{ marginTop: 26, fontSize: 40, lineHeight: 1.35, color: C.dim, maxWidth: 860 }}>{slide.body}</div>}
        </div>
      );
    case "list":
      return (
        <div>
          <H size={fit(slide.title, 110, 72, 1400)}>
            <Mark text={slide.title} />
          </H>
          <div style={{ marginTop: 40, display: "flex", flexDirection: "column", gap: 22 }}>
            {slide.items.map((it, i) => (
              <div key={i} style={{ display: "flex", gap: 24, alignItems: "baseline", fontSize: 40, lineHeight: 1.3 }}>
                <span style={{ fontFamily: F.stencil, fontWeight: 900, fontSize: 52, color: C.pitch, width: 60 }}>{String(i + 1).padStart(2, "0")}</span>
                <span>
                  <Mark text={it} />
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    case "compare":
      return (
        <div>
          {slide.title && (
            <div style={{ marginBottom: 40 }}>
              <H size={92}>
                <Mark text={slide.title} />
              </H>
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            {[slide.left, slide.right].map((col, ci) => (
              <div
                key={ci}
                style={{
                  borderRadius: 28,
                  padding: 32,
                  border: `2px solid ${ci === 1 ? C.pitch : C.ink600}`,
                  background: ci === 1 ? "rgba(10,233,138,0.07)" : "rgba(14,20,17,0.7)",
                  boxShadow: ci === 1 ? `0 0 60px -20px ${C.pitch}` : "none",
                }}
              >
                <div style={{ fontFamily: F.mono, fontSize: 24, letterSpacing: "0.12em", color: ci === 1 ? C.pitch : C.faint, marginBottom: 22 }}>
                  {col.label.toUpperCase()}
                </div>
                {col.items.map((it, i) => (
                  <div key={i} style={{ fontSize: 33, lineHeight: 1.3, marginBottom: 18, color: ci === 1 ? C.white : C.dim }}>
                    {ci === 1 ? "✓ " : "✕ "}
                    {it}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      );
    case "cta":
      return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 36 }}>
          <PinLogo size={110} />
          <H size={fit(slide.headline, 150, 90, 1700)}>
            {slide.headline.split("\n").map((l, i) => (
              <div key={i}>
                <Mark text={l} />
              </div>
            ))}
          </H>
          {slide.body && <PlainLine text={slide.body} size={40} />}
          <div
            style={{
              background: C.pitch,
              color: C.ink900,
              fontWeight: 800,
              fontSize: 40,
              padding: "22px 44px",
              borderRadius: 999,
              boxShadow: `0 0 50px -8px ${C.pitch}`,
            }}
          >
            {slide.cta}
          </div>
        </div>
      );
  }
};
