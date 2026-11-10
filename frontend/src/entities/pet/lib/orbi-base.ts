import type { Pet } from "../model/types";
import { painter } from "./pixel-painter";
import type { Grid } from "./pixel-painter";

type OrbiPet = Extract<Pet, { category: "orbi" }>;
function blend(first: string, second: string, amount: number): string {
  const a = parseInt(first.slice(1), 16),
    b = parseInt(second.slice(1), 16);
  const channels = [16, 8, 0].map((shift) =>
    Math.round(
      ((a >> shift) & 255) * (1 - amount) + ((b >> shift) & 255) * amount,
    ),
  );
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

export function createOrbiBaseGrid(pet: OrbiPet, frame: number): Grid {
  const grid: Grid = Array.from({ length: 32 }, () =>
    Array<string>(32).fill(""),
  );
  const mask: Grid = Array.from({ length: 32 }, () =>
    Array<string>(32).fill(""),
  );
  const shape = painter(mask);
  const pen = painter(grid, frame === 1 ? -1 : 0);
  const { rect: r, poly: p, dot: d } = pen;
  const [ink, body, accent, secondary, spot = blend(body, accent, 0.5)] =
    pet.palette;
  const light = blend(body, "#ffffff", 0.48),
    shade = blend(body, ink, 0.17);
  const { shell, gear, trim, pupil, look, satellites } = pet.orbiDesign;

  function ellipse(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    color: string,
  ) {
    for (let y = 1; y < 31; y++)
      for (let x = 1; x < 31; x++) {
        if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1)
          d(x, y, color);
      }
  }
  function rounded(
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
    radius = 1,
  ) {
    for (let yy = y; yy < y + h; yy++)
      for (let xx = x; xx < x + w; xx++) {
        const cx = Math.max(x + radius, Math.min(xx + 0.5, x + w - radius));
        const cy = Math.max(y + radius, Math.min(yy + 0.5, y + h - radius));
        if ((xx + 0.5 - cx) ** 2 + (yy + 0.5 - cy) ** 2 <= radius ** 2)
          d(xx, yy, color);
      }
  }
  function pill(x: number, y: number, w: number, h: number, color: string) {
    rounded(x, y, w, h, ink);
    rounded(x + 1, y + 1, w - 2, h - 2, color);
  }
  function bodyRound(
    x: number,
