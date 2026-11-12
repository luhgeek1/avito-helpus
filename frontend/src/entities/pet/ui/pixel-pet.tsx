import type { Pet } from "../model/types";
import { cx } from "@/shared/lib/cx";
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
      className={cx("pixel-pet relative z-2 block shrink-0 [image-rendering:pixelated]", className)}
      width={size}
      height={size}
      viewBox={`0 0 ${edge} ${edge}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={`${pet.kind} ${pet.name}, пиксельный персонаж`}
    >
      {frames.map((runs, i) => (
        <g
          // A paused pet shows its first frame; otherwise the frames take turns, and reduced motion keeps the first one.
          className={cx(
            "opacity-0",
            paused ? "animate-none" : "animate-sprite-frame",
            i === 0 && (paused ? "opacity-100" : "motion-reduce:opacity-100"),
          )}
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
