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
    x >= 0 &&
    x < 64 &&
    y >= 0 &&
    y < 64 &&
    bodyCells.has(Math.floor(y / 2) * 32 + Math.floor(x / 2));
  const [ink, body, accent, secondary, extra = mixColor(body, accent, 0.5)] =
    pet.palette;
  const light = mixColor(body, "#ffffff", 0.72),
    glow = mixColor(accent, "#ffffff", 0.55);
  const dark = mixColor(body, ink, 0.45),
    white = "#fffaf3";
  const { finish, shell, pupil, look, satellites, gear } = pet.orbiDesign;
  const lift = frame === 1 ? -2 : 0;
  for (let y = 1; y < 63; y++)
    for (let x = 1; x < 63; x++)
      if (hasBody(x, y)) {
        const color = base[Math.floor(y / 2)][Math.floor(x / 2)];
        if (color === ink || color === white) {
          grid[y][x] = color;
          continue;
        }
        const depth = Math.floor((x + y) / 16);
        grid[y][x] =
          depth <= 2
            ? mixColor(color, "#ffffff", 0.18)
            : depth >= 5
              ? mixColor(color, ink, 0.17)
              : color;
      }
  const surface = detailPainter(grid, lift, hasBody);
  const { rect: r, line: l, ellipse: e, arc: a, dot: d } = surface;
  // Inset edge highlights and little panel joints give every shell a tangible volume.
  for (let y = 8; y < 52; y++)
    for (let x = 11; x < 54; x++) {
      const yy = y + lift;
      if (!hasBody(x, yy) || grid[yy][x] === ink) continue;
      if (!hasBody(x - 3, yy) && hasBody(x + 2, yy)) d(x, y, light);
      if (!hasBody(x + 3, yy) && hasBody(x - 2, yy)) d(x, y, dark);
    }
  paintOrbiFinish(surface, finish, pet.palette, frame);

  // A machined lens rim, one large eye, and a small coloured pupil reflection.
  const rx = shell === "capsule" ? 9 : 11;
  e(33, 31, rx + 3, 15, ink);
  e(33, 31, rx + 2, 14, dark);
  a(33, 31, rx + 2, 14, 185, 310, light);
  a(33, 31, rx + 1, 13, 0, 115, accent);
  e(33, 31, rx, 12, frame === 2 ? mixColor(body, ink, 0.08) : white);
  a(33, 31, rx, 12, 185, 300, mixColor(accent, "#ffffff", 0.72));
  if (frame === 2) {
    r(33 - rx + 2, 30, rx * 2 - 4, 2, ink);
    r(33 - rx + 3, 32, rx * 2 - 6, 1, ink);
    l(28, 27, 37, 27, light);
    r(28, 34, 9, 1, mixColor(body, ink, 0.2));
  } else {
    // Clip the iris itself to the eyeball; it cannot escape the white on a glance.
    const iris = detailPainter(
      grid,
      lift,
      (x, y) =>
        hasBody(x, y) &&
        ((x + 0.5 - 33) / rx) ** 2 + ((y - lift + 0.5 - 31) / 12) ** 2 <= 1,
    );
    const cx = 33 + look * 2 + (frame === 3 ? -2 : 0);
    if (pupil === "bar") {
      iris.rect(cx - 4, 24, 8, 14, ink);
      iris.rect(cx - 2, 28, 5, 9, mixColor(ink, body, 0.18));
      iris.rect(cx - 3, 24, 3, 5, light);
      iris.rect(cx + 2, 34, 2, 2, accent);
      iris.dot(cx + 1, 37, secondary);
    } else if (pupil === "round") {
      iris.ellipse(cx, 31, 7, 8, ink);
      iris.ellipse(cx + 1, 32, 5, 5, mixColor(ink, body, 0.2));
      iris.rect(cx - 4, 25, 3, 4, light);
      iris.rect(cx + 3, 34, 2, 2, accent);
      iris.dot(cx, 37, secondary);
    } else {
      iris.poly(
        [
          [cx, 21],
          [cx + 7, 28],
          [cx + 7, 33],
          [cx, 41],
          [cx - 7, 33],
          [cx - 7, 28],
        ],
        ink,
      );
      iris.poly(
        [
          [cx, 27],
          [cx + 4, 30],
          [cx + 3, 35],
          [cx, 37],
          [cx - 2, 32],
        ],
        mixColor(ink, body, 0.25),
      );
      iris.rect(cx - 3, 25, 3, 4, light);
      iris.rect(cx + 3, 33, 2, 3, accent);
      iris.dot(cx, 38, secondary);
    }
    r(27, 23, 2, 2, "#ffffff");
    d(29, 23, "#ffffff");
    a(33, 31, rx - 1, 11, 195, 240, mixColor(body, "#ffffff", 0.82));
  }
  // Character-specific lens construction remains visible around the large eye.
  if (["prism", "circuit", "alloy"].includes(finish)) {
    const corners = [
      [22, 18, 1, 1],
      [44, 18, -1, 1],
      [22, 44, 1, -1],
      [44, 44, -1, -1],
    ];
    corners.forEach(([x, y, dx, dy]) => {
      l(x, y, x + dx * 4, y, ink);
      l(x, y, x, y + dy * 4, ink);
      d(x + dx, y + dy, glow);
    });
  }
  if (finish === "sun") {
    for (let i = 0; i < 12; i++) {
      const angle = (i * Math.PI) / 6;
      const x = Math.round(33 + Math.cos(angle) * (rx + 2)),
        y = Math.round(31 + Math.sin(angle) * 14);
      d(x, y, glow);
      d(x + 1, y, accent);
    }
  }
  if (finish === "quilt" || finish === "ribbon") {
    [
      [24, 21],
      [21, 28],
      [22, 37],
      [28, 44],
      [39, 43],
      [45, 36],
      [44, 25],
    ].forEach(([x, y]) => {
      l(x, y, x + 1, y + 1, ink);
      d(x, y, glow);
    });
  }
  if (finish === "cosmos") {
    a(33, 31, rx + 3, 15, 205, 330, glow);
    r(22, 20, 1, 3, secondary);
    r(21, 21, 3, 1, secondary);
    a(33, 31, rx + 2, 14, 20, 80, secondary);
  }
  if (finish === "botanical") {
