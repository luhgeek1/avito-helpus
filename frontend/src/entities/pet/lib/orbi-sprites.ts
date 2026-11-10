import type { Pet } from "../model/types";
import type { Grid } from "./pixel-painter";
import { createOrbiBaseGrid } from "./orbi-base";
import { DETAIL_EDGE, detailPainter, mixColor } from "./orbi-detail-painter";
import { paintOrbiFinish, paintOrbiParticle } from "./orbi-details";

type OrbiPet = Extract<Pet, { category: "orbi" }>;

// Detailed variants have their own renderer. The original `orbit` never enters here.
export function orbiSpriteGrid(pet: OrbiPet, frame: number): Grid {
  const base = createOrbiBaseGrid(pet, frame);
  const bodyCells = new Set<number>();
  const queue: number[][] = [[16, 15]];
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i],
      key = y * 32 + x;
    if (
      x < 0 ||
      x >= 32 ||
      y < 0 ||
      y >= 32 ||
      !base[y][x] ||
      bodyCells.has(key)
    )
      continue;
    bodyCells.add(key);
    queue.push([x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]);
  }
  const grid: Grid = Array.from({ length: DETAIL_EDGE }, () =>
    Array<string>(DETAIL_EDGE).fill(""),
  );
  const hasBody = (x: number, y: number) =>
