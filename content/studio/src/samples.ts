// Default props for Remotion Studio previews (npm run studio). Real posts live in
// content/<YYYY-Www>/posts/<NN-slug>/props.json and are rendered by scripts/render-week.mjs.
import type { CarouselProps, CinematicProps, ShortProps } from "./types";

export const sampleCarousel: CarouselProps = {
  coord: "33.902° S, 18.409° E · THU 19:00",
  index: 0,
  slides: [
    { kind: "cover", kicker: "ORGANISERS ONLY", headline: "Your group chat\nis not a *booking\nsystem*", sub: "Free 5-a-side organiser tool for Cape Town." },
    { kind: "cta", headline: "Never cancel\nfor being *2 short*", body: "Free for organisers. Founding numbers are going out now.", cta: "5sfindr.com" },
  ],
};

export const sampleShort: ShortProps = {
  coord: "33.902° S, 18.409° E · TUE 17:00",
  hook: { text: "SHORT *2*\nAT 17:00", sub: "Watch it fill." },
  beats: [
    {
      visual: { kind: "phone", screen: "fill", title: "Tuesday 5s", kickoff: "Tue · 18:30 · Green Point Urban Park", max: 10, startTaken: 8, names: ["Thabo", "Lerato", "Sam", "Aisha", "Luca", "Nandi", "Kyle", "Ama", "Pieter", "Zoe"] },
      caption: "One link in the group. Two strangers claim the spots.",
      minSec: 4,
    },
  ],
};

export const sampleCinematic: CinematicProps = {
  aspect: "9:16",
  coord: "33.902° S, 18.409° E · 19:00",
  shots: [
    { label: "S01 · floodlit fence, night", sec: 2 },
    { label: "S02 · real UI insert", sec: 3, insert: { screen: "invite", organiser: "Thabo", venue: "Green Point Urban Park", area: "Green Point", kickoff: "Thursday 19:00", court: false } },
  ],
};
