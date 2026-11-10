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
      pill(25, 24, 5, 5, pink);
      pill(2, 24, 4, 4, blue);
      break;
    }
    case "link": {
      pill(12, 4, 17, 18, purple);
      round(16, 8, 9, 10, "#e9ddfb");
      pill(3, 10, 18, 17, blue);
      round(7, 14, 10, 9, "#c4eafa");
      r(14, 12, 6, 7, o);
      r(15, 13, 5, 5, purple);
      r(14, 18, 5, 2, blue);
      // Offset eyes live inside their own loop instead of on the crossing.
      [
        [10, 16],
        [21, 10],
      ].forEach(([x, y]) => {
        r(x, y, 2, blink ? 1 : 3, o);
        if (!blink) d(x, y, white);
      });
      r(14, 22, 5, 1, o);
      d(13, 21, o);
      d(19, 21, o);
      pill(5, 26, 8, 4, pink);
      r(23, 20, 3, 5, o);
      r(24, 21, 1, 4, purple);
      pill(21, 23, 7, 7, green);
      r(16, 5, 7, 1, "#d6c4f2");
      r(4, 14, 1, 6, "#a1ddf7");
      if (frame === 3) r(25, 23, 3, 2, green);
      break;
    }
    case "find": {
      p(
        [
          [19, 21],
          [23, 19],
          [29, 27],
          [26, 30],
          [23, 29],
        ],
        o,
      );
      p(
        [
          [21, 22],
          [23, 21],
          [27, 27],
          [26, 28],
          [24, 27],
        ],
        pink,
      );
      r(25, 26, 2, 1, "#ffd1e0");
      const disc = (radius: number, color: string) => {
        for (let y = 3; y < 26; y++)
          for (let x = 3; x < 26; x++) {
            if ((x + 0.5 - 14.5) ** 2 + (y + 0.5 - 14.5) ** 2 <= radius ** 2)
              d(x, y, color);
          }
      };
      disc(11.5, o);
      disc(10.5, purple);
      disc(8.5, o);
      disc(7.5, b);
      r(9, 8, 8, 1, l);
      r(8, 10, 1, 6, l);
      round(11, 10, 8, 9, white);
      r(14, 11, 4, blink ? 1 : 6, o);
      if (!blink) {
        r(14, 11, 2, 2, l);
        d(17, 15, b);
      }
      smile(12, 19);
      r(5, 9, 2, 2, pink);
      r(13, 4, 2, 2, green);
      r(23, 12, 2, 2, blue);
      r(13, 23, 2, 2, pink);
      pill(2, 22 + wave, 5, 5, green);
      break;
    }
    case "pack": {
      p(
        [
          [5, 15],
          [2, 10],
          [12, 8],
          [16, 13],
          [22, 7],
          [30, 11],
          [26, 17],
        ],
        o,
      );
      p(
        [
          [5, 13],
          [4, 11],
          [11, 10],
          [14, 13],
        ],
        pink,
      );
      p(
        [
          [19, 13],
          [23, 9],
          [28, 11],
          [25, 15],
        ],
        green,
      );
      pill(9, 4, 15, 18, blue);
      r(12, 5, 7, 1, "#a1ddf7");
      eyes(pen, 12, 9, 7, blink, o);
      smile(13, 14);
      p(
        [
          [5, 16],
          [17, 13],
          [27, 17],
          [26, 27],
          [16, 30],
          [5, 26],
        ],
        o,
      );
      p(
        [
          [6, 17],
          [16, 15],
          [16, 28],
          [6, 25],
        ],
        b,
      );
      p(
        [
          [17, 15],
          [26, 18],
          [25, 26],
          [17, 28],
        ],
        l,
      );
      r(10, 18, 2, 8, "#d6c4f2");
      r(20, 18, 2, 7, pink);
      r(18, 22, 5, 3, white);
      r(19, 23, 3, 1, blue);
      pill(3, 20 + wave, 4, 5, pink);
      pill(26, 20, 4, 5, green);
      break;
    }
    case "spark": {
      const outline = [
        [15, 2],
        [20, 10],
        [29, 10],
        [24, 18],
        [28, 27],
        [18, 24],
        [10, 30],
        [9, 21],
        [2, 15],
        [11, 11],
      ];
      p(outline, o);
      p(
        [
          [15, 5],
          [19, 12],
          [26, 12],
          [22, 18],
          [25, 25],
          [18, 22],
          [11, 27],
          [11, 20],
          [5, 15],
          [13, 13],
        ],
        b,
      );
      p(
        [
          [5, 15],
          [12, 14],
          [13, 18],
          [11, 20],
        ],
        blue,
      );
      p(
        [
          [15, 5],
          [18, 10],
          [15, 11],
          [14, 10],
        ],
        purple,
      );
      p(
        [
          [19, 23],
          [23, 23],
          [25, 25],
          [20, 24],
        ],
        green,
      );
      eyes(pen, 12, 14, 7, blink, o);
      smile(13, 19);
      r(17, 7, 1, 3, l);
      if (frame === 3) {
        r(3, 5, 3, 1, purple);
        r(4, 4, 1, 3, purple);
      }
      break;
    }
    case "stack": {
      pill(18, 3, 10, 13, purple);
      r(20, 4, 5, 1, "#d6c4f2");
      pill(3, 16, 14, 13, pink);
      r(5, 17, 6, 1, "#ffd1e0");
      pill(16, 19, 13, 11, green);
      r(19, 20, 6, 1, "#d9edac");
      pill(6, 5, 17, 17, b);
      r(8, 6, 9, 1, l);
      r(7, 9, 1, 8, l);
      eyes(pen, 10, 10, 7, blink, o);
      smile(12, 16);
      r(6, 27, 6, 3, o);
      r(7, 27, 4, 2, pink);
      r(21, 28, 6, 2, o);
      r(22, 28, 4, 1, green);
      pill(1, 18 + wave, 4, 6, purple);
      pill(26, 13, 4, 6, blue);
      break;
    }
    case "totem": {
      pill(8, 24, 8, 6, pink);
      pill(18, 24, 8, 6, pink);
      pill(6, 18, 21, 8, blue);
      r(9, 19, 12, 1, "#a1ddf7");
      pill(8, 12, 17, 8, purple);
      r(11, 13, 9, 1, "#d6c4f2");
      pill(9, 3, 15, 11, b);
      r(12, 4, 7, 1, l);
      eyes(pen, 12, 6, 6, blink, o);
      smile(13, 10);
      pill(3, 14 + wave, 6, 5, green);
      pill(24, 15, 5, 6, pink);
      r(15, 2, 3, 2, o);
      r(16, 2, 1, 2, purple);
      break;
    }
    case "portal": {
      pill(2, 19 + wave, 6, 6, pink);
      pill(24, 17, 6, 7, green);
      round(6, 3, 20, 26, o);
      round(7, 4, 18, 24, b);
      round(9, 7, 14, 19, o);
      round(10, 8, 12, 17, blue);
      r(11, 9, 8, 1, "#a1ddf7");
      r(10, 11, 1, 8, "#a1ddf7");
      eyes(pen, 12, 13, 6, blink, o);
      smile(13, 19);
      r(15, 21, 3, 1, white);
      [
        [10, green],
        [14, blue],
        [18, pink],
        [22, purple],
      ].forEach(([x, c]) => r(x as number, 5, 2, 2, c as string));
      r(7, 27, 6, 3, o);
      r(20, 27, 6, 3, o);
      r(8, 27, 4, 2, green);
      r(21, 27, 4, 2, pink);
      r(23, 18, 2, 3, green);
      d(24, 19, white);
      break;
    }
    case "cursor": {
      p(
        [
          [7, 2],
          [29, 18],
          [21, 20],
          [25, 28],
          [19, 31],
          [14, 22],
          [7, 27],
        ],
        o,
      );
      p(
        [
          [9, 6],
          [25, 17],
          [18, 19],
          [23, 27],
          [20, 28],
          [15, 19],
          [9, 23],
        ],
        b,
      );
      r(9, 8, 1, 11, l);
      p(
        [
          [10, 7],
          [16, 11],
          [11, 11],
        ],
        l,
      );
      eyes(pen, 12, 13, 6, blink, o);
      r(14, 18, 4, 1, o);
      pill(4, 17 + wave, 5, 6, purple);
      pill(7, 25, 7, 4, green);
      pill(19, 27, 7, 3, pink);
      break;
    }
    case "chat": {
      pill(16, 2, 8, 8, purple);
      r(18, 3, 3, 1, "#d6c4f2");
      pill(2, 15 + wave, 6, 7, green);
      pill(25, 14, 6, 8, pink);
      round(5, 6, 23, 18, o);
      round(6, 7, 21, 16, b);
      p(
        [
          [10, 22],
          [10, 30],
          [19, 23],
        ],
        o,
      );
      p(
        [
          [12, 22],
          [12, 27],
          [16, 23],
        ],
        b,
      );
      r(9, 7, 11, 1, l);
      r(6, 10, 2, 8, l);
      eyes(pen, 11, 12, 9, blink, o);
      round(15, 18, 7, 4, o);
      r(17, 18, 2, 2, white);
      r(8, 18, 2, 2, pink);
      r(24, 18, 2, 2, pink);
      pill(20, 24, 6, 5, purple);
      break;
    }
    case "magnet": {
      round(6, 4, 21, 25, o);
      round(7, 5, 19, 23, b);
      r(12, 3, 9, 15, "");
      r(13, 17, 7, 3, "");
      r(7, 5, 5, 8, blue);
      r(21, 5, 5, 8, pink);
      r(7, 11, 5, 2, white);
      r(21, 11, 5, 2, white);
      r(8, 6, 1, 4, "#a1ddf7");
      r(22, 6, 3, 1, "#ffd1e0");
      eyes(pen, 11, 21, 9, blink, o);
      smile(14, 25);
      pill(7, 27, 7, 3, green);
      pill(21, 27, 7, 3, green);
      pill(3, 19 + wave, 5, 5, blue);
      pill(26, 18, 4, 6, pink);
      if (frame === 3) {
        r(14, 6, 4, 1, purple);
        r(15, 5, 2, 3, purple);
      }
      break;
    }
    default:
      throw new Error(`Unknown mascot sprite: ${pet.id}`);
  }
  return grid;
}
