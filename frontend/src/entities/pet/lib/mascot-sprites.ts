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
      pill(12, 3, 9, 9, purple);
      r(14, 4, 4, 1, "#d9c8f2");
      pill(3, 15 + wave, 8, 9, pink);
      r(4, 17 + wave, 2, 3, "#ffd1e0");
      pill(23, 12, 7, 10, green);
      r(26, 14, 2, 3, "#d9edac");
      pill(8, 8, 18, 19, b);
      r(11, 9, 8, 1, l);
      r(9, 12, 2, 8, l);
      eyes(pen, 12, 13, 8, blink, o);
      r(10, 18, 2, 2, pink);
      r(23, 18, 2, 2, green);
      smile(14, 20);
      d(16, 22, white);
      pill(8, 25, 8, 5, purple);
      pill(18, 25, 8, 5, blue);
      break;
    }
    case "avo": {
      p(
        [
          [13, 4],
          [20, 4],
          [28, 29],
          [21, 30],
          [18, 22],
          [13, 22],
          [11, 30],
          [4, 29],
        ],
        o,
      );
      p(
        [
          [14, 6],
          [19, 6],
          [26, 28],
          [23, 28],
          [19, 20],
          [12, 20],
          [9, 28],
          [6, 28],
        ],
        b,
      );
      p(
        [
          [14, 21],
          [18, 21],
          [21, 30],
          [11, 30],
        ],
        "",
      );
      r(11, 20, 10, 2, green);
      r(13, 6, 6, 2, l);
      eyes(pen, 12, 11, 6, blink, o);
      smile(13, 16);
      p(
        [
          [16, 4],
          [18, 2],
          [23, 3],
          [23, 5],
          [19, 7],
        ],
        o,
      );
      r(18, 3, 4, 2, purple);
      pill(3, 17 + wave, 5, 6, pink);
      pill(24, 17, 5, 6, green);
      r(5, 28, 5, 2, purple);
      r(23, 28, 4, 2, pink);
      break;
    }
    case "plus": {
      p(
        [
          [11, 3],
          [21, 3],
          [21, 10],
          [29, 10],
          [29, 21],
          [21, 21],
          [21, 29],
          [11, 29],
          [11, 21],
          [3, 21],
          [3, 10],
          [11, 10],
        ],
        o,
      );
      r(12, 4, 8, 8, purple);
      r(4, 11, 9, 9, blue);
      r(20, 11, 8, 9, pink);
      r(12, 20, 8, 8, green);
      r(11, 10, 10, 12, b);
      r(12, 11, 8, 9, l);
      eyes(pen, 12, 13, 6, blink, o);
      smile(13, 18);
      r(14, 4, 4, 1, "#d6c4f2");
      r(4, 12, 1, 5, "#a1ddf7");
      r(24, 12, 3, 1, "#ffd1e0");
      r(10, 28, 5, 2, o);
      r(18, 28, 5, 2, o);
      r(11, 28, 3, 1, pink);
      r(19, 28, 3, 1, blue);
      if (frame === 3) {
        r(27, 10, 3, 2, pink);
        r(28, 12, 2, 2, o);
      }
      break;
    }
    case "clip": {
      pill(9, 3, 15, 26, b);
      round(12, 7, 9, 18, "");
      pill(13, 12, 6, 13, l);
      r(16, 14, 1, 7, b);
      round(10, 4, 13, 11, b);
      r(12, 5, 7, 1, l);
      eyes(pen, 12, 8, 7, blink, o);
      r(15, 12, 4, 1, o);
      pill(4, 15 + wave, 7, 5, green);
      pill(22, 17, 6, 5, blue);
      pill(7, 27, 8, 3, pink);
      pill(20, 27, 7, 3, blue);
      r(22, 24, 4, 2, o);
      r(25, 24, 3, 5, o);
      r(26, 25, 1, 3, green);
      break;
    }
    case "orbit": {
      pill(4, 12, 24, 10, purple);
      r(3, 15, 26, 2, o);
      pill(8, 6, 17, 20, l);
      round(10, 8, 13, 14, b);
      r(12, 8, 8, 1, w);
      round(12, 11, 9, 9, white);
      r(15, 12, 4, blink ? 1 : 6, o);
      if (!blink) {
        r(15, 12, 2, 2, l);
        d(18, 16, b);
      }
      r(12, 22, 9, 2, pink);
      r(20, 23, 3, 4, pink);
      pill(9, 26, 6, 4, blue);
      pill(19, 26, 6, 4, purple);
      pill(2, 8, 5, 5, green);
      pill(25, 3 + wave, 5, 5, purple);
