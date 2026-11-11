import type { Pet } from "../model/types";
import { spriteFrames } from "../lib/sprite-frames";
export function PixelPet({
  pet,
  size = 160,
  paused = false,
  className = "",
}: {
  pet: Pet;
  size?: number;
  paused?: boolean;
  className?: string;
}) {
  const { frames, edge } = spriteFrames(pet);
  return (
    <svg
      className={`pixel-pet block relative [image-rendering:pixelated] shrink-0 z-2 [&.is-paused_.sprite-frame]:animate-none
            [&.is-paused_.sprite-frame:not(.frame-0)]:opacity-0 [&.is-paused_.frame-0]:opacity-100 ${paused ? "is-paused" : ""}  ${className}`}
      width={size}
      height={size}
      viewBox={`0 0 ${edge} ${edge}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={`${pet.kind} ${pet.name}, пиксельный персонаж`}
    >
      {frames.map((runs, i) => (
        <g
          className={`sprite-frame opacity-0 animate-sprite-frame motion-reduce:opacity-0 motion-reduce:[&.frame-0]:opacity-100
            frame-${i}`}
          key={i}
          style={{ animationDelay: `-${(4 - i) * 0.8}s` }}
        >
          {runs.map(({ color, path }) => (
            <path key={color} d={path} fill={color} />
          ))}
        </g>
      ))}
    </svg>
  );
}
