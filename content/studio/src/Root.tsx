import React from "react";
import { Composition, Still } from "remotion";
import { Carousel } from "./carousel/Carousel";
import { Short, calculateShortMetadata, FPS, type ShortRenderProps } from "./short/Short";
import { Cinematic, calculateCinematicMetadata, CINE_FPS } from "./cinematic/Cinematic";
import { sampleCarousel, sampleCinematic, sampleShort } from "./samples";
import type { CarouselProps, CinematicProps } from "./types";

export const Root: React.FC = () => (
  <>
    {/* IG carousel slide, 4:5 */}
    <Still id="Carousel" component={Carousel as React.FC<CarouselProps>} width={1080} height={1350} defaultProps={sampleCarousel} />
    {/* TikTok / Reels short, 9:16 */}
    <Composition
      id="Short"
      component={Short as React.FC<ShortRenderProps>}
      width={1080}
      height={1920}
      fps={FPS}
      durationInFrames={300}
      defaultProps={sampleShort as ShortRenderProps}
      calculateMetadata={calculateShortMetadata}
    />
    {/* AI cinematic edit, 9:16 / 4:5 / 1:1 */}
    <Composition
      id="Cinematic"
      component={Cinematic as React.FC<CinematicProps>}
      width={1080}
      height={1920}
      fps={CINE_FPS}
      durationInFrames={300}
      defaultProps={sampleCinematic}
      calculateMetadata={calculateCinematicMetadata}
    />
  </>
);
