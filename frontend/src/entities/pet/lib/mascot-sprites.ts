import type { Pet } from "../model/types";
import { eyes, painter } from "./pixel-painter";
import type { Grid } from "./pixel-painter";

// Shared brand colours are structural parts of the characters, not a logo sticker.
const blue = "#4dbbf0",
  green = "#a8d777",
  pink = "#f18fb0",
  purple = "#ac8ce2";
const white = "#fff9f3";

export function mascotSpriteGrid(pet: Pet, frame: number): Grid {
  const grid: Grid = Array.from({ length: 32 }, () =>
    Array<string>(32).fill(""),
  );
  const pen = painter(grid, frame === 1 ? -1 : 0);
  const { rect: r, poly: p, dot: d } = pen;
  const [o, b, l, w] = pet.palette;
  const blink = frame === 2;
  // Chamfered corners keep every edge on the integer pixel grid.
  const round = (
    x: number,
    y: number,
    width: number,
    height: number,
    c: string,
  ) =>
    p(
      [
        [x + 2, y],
        [x + width - 2, y],
        [x + width, y + 2],
        [x + width, y + height - 2],
        [x + width - 2, y + height],
        [x + 2, y + height],
        [x, y + height - 2],
        [x, y + 2],
      ],
      c,
    );
  const pill = (
    x: number,
    y: number,
    width: number,
    height: number,
    c: string,
  ) => {
    round(x, y, width, height, o);
    round(x + 1, y + 1, width - 2, height - 2, c);
  };
  const smile = (x: number, y: number) => {
    d(x, y, o);
    d(x + 5, y, o);
    r(x + 1, y + 1, 4, 1, o);
  };
  const wave = frame === 3 ? -2 : 0;

  switch (pet.id) {
    case "avik": {
