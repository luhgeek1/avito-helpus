import type { Pet } from "../model/types";
import { painter, eyes } from "./pixel-painter";
import type { Grid } from "./pixel-painter";
import { mascotSpriteGrid } from "./mascot-sprites";
import { orbiSpriteGrid } from "./orbi-sprites";

export function spriteGrid(pet: Pet, frame: number): Grid {
  if (pet.category === "orbi") return orbiSpriteGrid(pet, frame);
  if (pet.category === "mascots") return mascotSpriteGrid(pet, frame);
  const grid = Array.from({ length: 32 }, () => Array<string>(32).fill(""));
  const lift = frame === 1 ? -1 : 0,
    blink = frame === 2;
  const { rect: r, poly: p, dot: d } = painter(grid, lift);
  const pen = painter(grid, lift);
  const [o, b, l, w] = pet.palette;
  if (pet.id === "cat") {
    // A curled tail, triangular ears, paws and a contrasting muzzle.
    r(25, 19, 3, 8, o);
    r(26, 17, 3, 5, o);
    r(26, 19, 1, 6, b);
    r(23, 25, 4, 3, o);
    r(9, 18, 15, 10, o);
    r(10, 19, 13, 8, b);
    r(12, 21, 8, 6, l);
    p(
      [
        [6, 6],
        [8, 4],
        [13, 8],
        [21, 8],
        [25, 4],
        [27, 6],
        [27, 18],
        [24, 22],
        [9, 22],
        [6, 19],
      ],
      o,
    );
    p(
      [
        [8, 7],
        [12, 10],
        [22, 10],
        [25, 7],
        [25, 18],
        [22, 20],
        [10, 20],
        [8, 18],
      ],
      b,
    );
    p(
      [
        [8, 7],
        [11, 10],
        [8, 11],
      ],
      "#e7b5d3",
    );
    p(
      [
        [25, 7],
        [22, 10],
        [25, 11],
      ],
      "#e7b5d3",
    );
    r(12, 16, 9, 4, l);
    eyes(pen, 10, 12, 11, blink, o);
    r(16, 16, 2, 1, o);
    d(15, 18, o);
    d(18, 18, o);
    r(8, 27, 7, 3, o);
    r(18, 27, 7, 3, o);
    r(9, 27, 5, 2, l);
    r(19, 27, 5, 2, l);
    r(9, 22, 15, 2, "#80c6be");
    r(16, 23, 2, 2, "#ffe19c");
  } else if (pet.id === "corgi") {
    p(
      [
        [7, 14],
        [4, 4],
        [7, 3],
        [13, 10],
        [20, 10],
        [26, 3],
        [29, 4],
        [26, 16],
      ],
      o,
    );
    p(
      [
        [7, 12],
        [6, 6],
        [8, 6],
        [12, 12],
        [21, 12],
        [26, 6],
        [27, 6],
        [25, 15],
      ],
      b,
    );
    r(8, 18, 17, 11, o);
    r(9, 19, 15, 9, b);
    r(13, 21, 7, 7, w);
    r(6, 12, 21, 11, o);
    r(7, 11, 19, 11, b);
    r(10, 17, 13, 7, w);
    r(14, 11, 5, 10, w);
    r(7, 7, 2, 5, "#e6ab91");
    r(25, 7, 2, 5, "#e6ab91");
    eyes(pen, 10, 14, 12, blink, o);
    r(15, 18, 4, 2, o);
    d(16, 20, o);
    r(14, 21, 5, 1, o);
    r(8, 27, 6, 3, o);
    r(20, 27, 6, 3, o);
    r(9, 27, 4, 2, w);
    r(21, 27, 4, 2, w);
    r(26, 22, 3, 4, o);
    r(27, frame === 3 ? 20 : 21, 2, 3, w);
    r(9, 23, 16, 2, "#72bcae");
  } else if (pet.id === "owl") {
    p(
      [
        [6, 8],
        [5, 4],
        [11, 7],
        [21, 7],
        [27, 4],
        [26, 9],
        [28, 13],
        [28, 24],
        [24, 28],
        [9, 28],
        [5, 24],
        [5, 13],
      ],
      o,
    );
    p(
      [
        [7, 11],
