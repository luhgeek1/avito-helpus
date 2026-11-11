import type { Pet } from "../model/types";
import { pixelRuns, spriteGrid } from "./sprite";

const cache = new WeakMap<Pet, { frames: { color: string; path: string }[][]; edge: number }>();

export function spriteFrames(pet: Pet) {
  const saved = cache.get(pet);
  if (saved) return saved;
  const grids = Array.from({ length: 4 }, (_, frame) => spriteGrid(pet, frame));
  const frames = grids.map(grid => {
    const colors = new Map<string, string>();
    for (const { x, y, w, color } of pixelRuns(grid)) {
      colors.set(color, (colors.get(color) ?? "") + `M${x} ${y}h${w}v1H${x}z`);
    }
    return Array.from(colors, ([color, path]) => ({ color, path }));
  });
  const result = { frames, edge: grids[0].length };
  cache.set(pet, result);
  return result;
}
