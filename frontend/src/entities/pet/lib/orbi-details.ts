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
      l(23, 19, 23, 24, ink);
      l(17, 20, 22, 20, accent);
      l(22, 20, 22, 25, accent);
      l(46, 22, 49, 22, secondary);
      l(49, 22, 49, 41, secondary);
      l(49, 41, 44, 41, secondary);
      l(22, 45, 28, 45, accent);
      l(28, 45, 28, 49, accent);
      l(28, 49, 41, 49, accent);
      [
        [18, 18],
        [47, 20],
        [43, 40],
        [26, 47],
      ].forEach(([x, y]) => rivet(x, y, glow, ink));
      r(35, 13, 7, 2, muted);
      d(frame === 3 ? 40 : 36, 13, light);
      break;
    case "ceramic":
      a(33, 31, 12, 22, 175, 285, light);
      a(33, 32, 12, 20, 350, 70, mixColor(body, ink, 0.2));
      r(24, 44, 18, 2, ink);
      r(25, 44, 16, 1, accent);
      r(28, 47, 10, 2, secondary);
      e(22, 37, 3, 2, secondary);
      e(43, 37, 3, 2, secondary);
      r(29, 13, 8, 1, light);
      l(23, 21, 23, 24, light);
      break;
    case "cosmos":
      a(33, 32, 20, 18, 170, 320, accent);
      a(33, 32, 19, 17, 170, 320, glow);
      [
        [22, 22],
        [21, 37],
        [42, 40],
        [38, 15],
      ].forEach(([x, y]) => {
        d(x, y, light);
        d(x + 2, y + 1, secondary);
      });
      poly(
        [
          [44, 20],
          [47, 24],
          [46, 29],
          [44, 26],
        ],
        secondary,
      );
      r(25, 46, 17, 2, secondary);
      r(29, 49, 8, 1, accent);
      break;
    case "cloud":
      a(33, 31, 13, 22, 190, 285, light);
      a(33, 32, 12, 21, 10, 85, accent);
      [
        [24, 19, 7],
        [24, 23, 5],
        [38, 40, 5],
        [26, 45, 12],
      ].forEach(([x, y, w]) => {
        r(x, y, w, 1, mixColor(body, "#ffffff", 0.5));
        d(x + w, y - 1, light);
      });
      r(25, 48, 17, 1, muted);
      r(30, 49, 7, 1, secondary);
      r(40, 17, 2, 2, light);
      break;
    case "clay":
      l(24, 13, 43, 13, accent);
      l(17, 24, 17, 40, muted);
      l(48, 25, 48, 39, muted);
      [
        [23, 16],
        [43, 19],
        [22, 41],
        [43, 42],
      ].forEach(([x, y]) => rivet(x, y, mixColor(body, "#fff1d0", 0.65), ink));
      r(23, 46, 21, 3, ink);
      r(24, 46, 19, 1, secondary);
      r(30, 47, 6, 1, accent);
      l(18, 30, 21, 32, accent);
      break;
    case "ribbon":
      a(33, 32, 18, 19, 186, 290, secondary);
      a(33, 32, 17, 18, 190, 280, light);
      poly(
        [
          [19, 41],
          [23, 43],
          [31, 45],
          [44, 42],
          [46, 44],
          [33, 48],
          [24, 47],
          [20, 45],
        ],
        accent,
      );
      l(23, 43, 31, 46, light);
      r(31, 45, 4, 3, secondary);
      r(32, 45, 2, 1, light);
      poly(
        [
          [26, 16],
          [30, 12],
          [38, 15],
          [34, 18],
        ],
        mixColor(secondary, "#ffffff", 0.5),
      );
      break;
    case "alloy":
      l(24, 12, 41, 12, light);
      l(16, 24, 16, 38, muted);
      l(49, 24, 49, 38, ink);
      [
        [22, 16],
        [43, 17],
        [20, 40],
        [45, 39],
      ].forEach(([x, y]) => rivet(x, y, light, ink));
      [22, 26, 30].forEach((y) => {
        r(45, y, 3, 1, ink);
        d(45, y, secondary);
      });
      r(23, 46, 21, 3, ink);
      r(24, 46, 19, 1, accent);
      r(30, 48, 8, 1, secondary);
      break;
    case "botanical":
      a(33, 32, 19, 18, 130, 300, accent);
      a(33, 32, 17, 17, 135, 290, mixColor(accent, "#ffffff", 0.5));
      l(21, 38, 25, 45, accent);
      poly(
        [
          [20, 33],
          [24, 36],
          [23, 40],
          [20, 37],
        ],
        accent,
      );
      poly(
        [
          [23, 42],
          [26, 38],
          [28, 40],
          [26, 44],
        ],
        accent,
      );
      l(43, 37, 40, 45, accent);
      poly(
        [
          [43, 39],
          [47, 35],
          [48, 38],
          [45, 42],
        ],
        secondary,
      );
      e(23, 38, 2, 1, secondary);
      r(30, 48, 6, 1, light);
      break;
  }
}

export function paintOrbiParticle(
  p: DetailPainter,
  finish: OrbiFinish,
  x: number,
  y: number,
  color: string,
  ink: string,
  flash: boolean,
) {
  const { rect: r, ellipse: e, poly, line: l, dot: d, arc: a } = p;
  const light = mixColor(color, "#ffffff", flash ? 0.8 : 0.55),
    shade = mixColor(color, ink, 0.3);
  if (["prism", "tide", "ribbon", "clay"].includes(finish)) {
    poly(
      [
        [x, y - 4],
        [x + 4, y],
        [x, y + 4],
        [x - 4, y],
      ],
      ink,
    );
    poly(
      [
        [x, y - 3],
        [x + 3, y],
        [x, y + 3],
        [x - 3, y],
      ],
      color,
    );
    poly(
      [
        [x, y - 3],
        [x, y + 2],
        [x - 3, y],
      ],
      light,
    );
    l(x + 1, y, x, y + 2, shade);
  } else if (["sun", "night", "cosmos"].includes(finish)) {
    if (finish === "cosmos") {
      e(x, y, 3, 3, ink);
      e(x, y, 2, 2, color);
      l(x - 4, y + 1, x + 4, y - 1, ink);
      l(x - 3, y + 1, x + 3, y - 1, light);
    } else {
      poly(
        [
          [x, y - 4],
          [x + 1, y - 1],
          [x + 4, y],
          [x + 1, y + 1],
          [x, y + 4],
          [x - 1, y + 1],
          [x - 4, y],
          [x - 1, y - 1],
        ],
        ink,
      );
      r(x - 1, y - 1, 2, 2, light);
      d(x, y - 3, color);
      d(x + 2, y, color);
    }
  } else if (finish === "botanical") {
    poly(
      [
        [x - 4, y],
        [x, y - 4],
        [x + 4, y],
        [x, y + 4],
      ],
      ink,
    );
    poly(
      [
        [x - 3, y],
        [x, y - 3],
        [x + 3, y],
        [x, y + 3],
      ],
      color,
    );
    l(x - 2, y + 2, x + 2, y - 2, light);
  } else if (["circuit", "alloy"].includes(finish)) {
    r(x - 4, y - 3, 8, 6, ink);
    r(x - 3, y - 2, 6, 4, color);
    r(x - 2, y - 1, 4, 2, shade);
    l(x - 3, y - 2, x + 2, y - 2, light);
    d(x - 4, y - 1, color);
    d(x + 3, y + 1, color);
  } else {
    e(x, y, 4, 4, ink);
    e(x, y, 3, 3, color);
    a(x, y, 3, 3, 180, 300, light);
    e(x + 1, y + 1, 1, 1, shade);
    d(x - 1, y - 1, "#fffaf3");
  }
}
