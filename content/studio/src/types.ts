// Prop shapes for every template. A post's props.json must match one of these.

// ---------- Carousel (1080x1350 stills) ----------
export type Slide =
  | { kind: "cover"; kicker?: string; headline: string; sub?: string }
  | { kind: "point"; n: string; title: string; body: string }
  | { kind: "stat"; big: string; label: string; body?: string }
  | { kind: "compare"; title?: string; left: { label: string; items: string[] }; right: { label: string; items: string[] } }
  | { kind: "list"; title: string; items: string[] }
  | { kind: "cta"; headline: string; body?: string; cta: string };

export type CarouselProps = {
  type?: "carousel";
  id?: string;
  coord?: string; // e.g. "33.902° S, 18.409° E · THU 19:00"
  slides: Slide[];
  index: number; // which slide to render (the render script loops)
};

// ---------- Phone screens (mocked from the real app's components) ----------
export type MockGame = {
  day: string; // "Thu 20 Nov"
  time: string; // "19:00"
  title: string; // venue or game title
  court: boolean; // official court vs open field
  price?: number; // R per player, courts only
  taken: number;
  max: number;
};

export type Screen =
  | { screen: "feed"; heading?: string; games: MockGame[] }
  | { screen: "invite"; organiser: string; venue: string; area: string; kickoff: string; court: boolean; claimAt?: number }
  | { screen: "fill"; title: string; kickoff: string; max: number; startTaken: number; names: string[]; endLabel?: string }
  | { screen: "chat"; group: string; messages: { from: string; text: string; me?: boolean }[] };

// ---------- Short (1080x1920 video) ----------
export type Visual =
  | { kind: "type"; lines: string[]; accent?: number; small?: string }
  | ({ kind: "phone"; label?: string } & Screen)
  | { kind: "stat"; big: string; label: string; small?: string }
  | { kind: "list"; title: string; items: string[] }
  | { kind: "clip"; src: string; startFrom?: number; label?: string } // stock or AI clip in the week folder
  | { kind: "map"; areas: { name: string; now: number; goal: number }[]; title?: string };

// A sound-design cue: a name from the week's sfx library ("crt-on", "dialup", "im-alert" … see VOICE.md) or a path
// in the week folder, played `at` seconds after its segment starts (default 0; negative = before the segment ends)
// at `vol` (default 0.7). No music.
export type Sfx = string | { src: string; at?: number; vol?: number };

export type Beat = {
  visual: Visual;
  caption?: string; // burned-in caption = the voice line. Empty = no caption.
  vo?: string; // path inside the week folder, e.g. "vo/p01-b1.wav"
  voText?: string; // what the AI voice says (scripts/voice.mjs turns it into the vo file); ~word~ forces a glitch
  minSec?: number; // beat length when there is no voice line yet
  sfx?: Sfx[];
};

export type ShortProps = {
  type?: "short";
  id?: string;
  coord?: string;
  hook: { text: string; sub?: string; vo?: string; voText?: string; minSec?: number; sfx?: Sfx[] }; // on screen from frame 0
  beats: Beat[];
  end?: { line?: string; cta?: string; vo?: string; voText?: string; sfx?: Sfx[] };
  bed?: string; // optional room-tone file in the week folder, dipped under the voice (voice.json "bed": "machine")
  gapSec?: number; // pause after each voice line before the next beat (default 0.35; voice.mjs sets the week's value)
  aiVoice?: boolean; // voice lines are AI: shows the "AI voice" chip; queue.mjs sets the AI label
  voice?: string; // which voice made them, e.g. "Chatterbox (bm_george timbre)" (set by scripts/voice.mjs)
};

// ---------- Cinematic edit (AI clips + real UI composites) ----------
export type Corner = [number, number];
export type ScreenPin = {
  // corners (TL, TR, BR, BL) of the phone screen inside the clip, in clip pixels (1080x1920), per keyframe second
  keys: { t: number; corners: [Corner, Corner, Corner, Corner] }[];
  screen: Screen;
};

export type Shot = {
  src?: string; // generated clip in the concept folder; missing = slate placeholder
  label: string; // "S03 · over-the-shoulder, phone glow"
  sec: number;
  pin?: ScreenPin; // composite real UI onto the phone in the clip
  insert?: Screen; // or cut to a full-frame real-UI insert
  title?: string; // on-screen teaser line
  caption?: string;
};

export type CinematicProps = {
  id?: string;
  aspect: "9:16" | "4:5" | "1:1";
  coord?: string;
  shots: Shot[];
  vo?: string;
  bed?: string;
  plainLine?: string; // two-line rule, defaults to PLAIN_LINE
  disclosure?: string; // e.g. "AI-generated scenes · real app". Always on for AI shorts.
};
