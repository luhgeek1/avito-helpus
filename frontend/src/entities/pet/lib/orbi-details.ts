import type { OrbiFinish } from "../model/types";
import type { DetailPainter } from "./orbi-detail-painter";
import { mixColor } from "./orbi-detail-painter";

export function paintOrbiFinish(
  p: DetailPainter,
  finish: OrbiFinish,
  colors: string[],
  frame: number,
) {
  const [ink, body, accent, secondary] = colors;
  const light = mixColor(body, "#ffffff", 0.7),
    muted = mixColor(body, ink, 0.24),
    glow = mixColor(accent, "#ffffff", 0.55);
  const { rect: r, line: l, arc: a, dot: d, poly, ellipse: e, rivet } = p;
  switch (finish) {
    case "prism":
      l(20, 18, 20, 45, accent);
      l(21, 18, 21, 34, light);
      l(46, 17, 46, 45, secondary);
      l(42, 14, 47, 19, accent);
      r(21, 45, 23, 4, ink);
      r(22, 45, 21, 2, secondary);
      r(25, 49, 5, 1, light);
      r(36, 49, 5, 1, accent);
      [
        [23, 15],
        [43, 18],
        [20, 40],
      ].forEach(([x, y]) => rivet(x, y, light, ink));
      r(43, 40, 2, frame === 3 ? 4 : 2, glow);
      break;
    case "glass":
      a(33, 31, 13, 22, 192, 285, light);
      a(33, 31, 11, 20, 190, 265, glow);
      l(25, 17, 38, 10, light);
      l(27, 18, 37, 12, mixColor(body, "#ffffff", 0.4));
      r(23, 44, 20, 4, muted);
      r(25, 45, 16, 2, secondary);
      r(30, 48, 5, 1, accent);
      r(26, 40, 2, 2, light);
      d(39, 19, light);
      break;
    case "quilt":
      a(33, 32, 18, 18, 135, 300, accent);
      a(33, 32, 17, 17, 135, 300, glow);
      [
        [21, 19],
        [18, 25],
        [18, 36],
        [22, 43],
        [30, 47],
        [40, 45],
        [48, 36],
      ].forEach(([x, y]) => {
        l(x, y, x + 2, y + 2, ink);
        d(x, y, glow);
      });
      e(20, 39, 3, 2, secondary);
      e(46, 38, 3, 2, secondary);
      l(26, 48, 39, 48, accent);
      r(29, 10, 9, 2, muted);
      r(31, 10, 5, 1, glow);
      break;
    case "sun":
      [
        [20, 17],
        [44, 17],
        [20, 45],
        [44, 45],
      ].forEach(([x, y]) => rivet(x, y, glow, ink));
      r(16, 17, 3, 28, muted);
      r(47, 17, 3, 28, muted);
      r(17, 21, 1, 9, accent);
      l(22, 15, 43, 15, secondary);
      r(22, 47, 22, 3, ink);
      r(24, 47, 17, 1, accent);
      [25, 30, 35, 40].forEach((x) => r(x, 49, 2, 1, glow));
      break;
    case "tide":
      a(32, 43, 20, 10, 20, 160, accent);
      a(31, 45, 20, 9, 25, 155, secondary);
      a(33, 30, 20, 17, 198, 262, light);
      l(17, 25, 17, 36, secondary);
      l(49, 24, 49, 36, accent);
      poly(
        [
          [20, 42],
          [24, 43],
          [27, 41],
          [29, 42],
          [25, 46],
          [22, 45],
        ],
        mixColor(accent, "#ffffff", 0.2),
      );
      r(30, 49, 7, 1, light);
      break;
    case "pearl":
      a(33, 32, 18, 19, 190, 300, light);
      a(34, 31, 17, 18, 8, 80, accent);
      poly(
        [
          [23, 18],
          [31, 12],
          [39, 15],
          [34, 18],
        ],
        mixColor(body, "#ffffff", 0.6),
      );
      r(23, 43, 17, 2, secondary);
      r(26, 46, 12, 1, accent);
      e(23, 35, 2, 3, mixColor(body, "#ffffff", 0.5));
      [
        [25, 45],
        [30, 47],
        [35, 47],
      ].forEach(([x, y]) => d(x, y, light));
      break;
    case "night":
      r(19, 17, 5, 28, muted);
      r(43, 17, 5, 28, ink);
      r(44, 19, 2, 11, accent);
      [
        [22, 16],
        [43, 41],
        [24, 43],
      ].forEach(([x, y]) => {
        r(x, y, 1, 3, light);
        r(x - 1, y + 1, 3, 1, light);
      });
      l(21, 47, 45, 47, accent);
      r(24, 48, 5, 2, secondary);
      r(39, 48, 4, 2, accent);
      r(24, 14, 17, 1, light);
      l(24, 15, 28, 19, muted);
      break;
    case "circuit":
      l(17, 19, 23, 19, ink);
