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
    y: number,
    w: number,
    h: number,
    radius: number,
  ) {
    for (let yy = y; yy < y + h; yy++)
      for (let xx = x; xx < x + w; xx++) {
        const cx = Math.max(x + radius, Math.min(xx + 0.5, x + w - radius));
        const cy = Math.max(y + radius, Math.min(yy + 0.5, y + h - radius));
        if ((xx + 0.5 - cx) ** 2 + (yy + 0.5 - cy) ** 2 <= radius ** 2)
          shape.dot(xx, yy, "1");
      }
  }
  switch (shell) {
    case "visor":
      bodyRound(8, 6, 18, 20, 2);
      break;
    case "capsule":
      bodyRound(9, 4, 15, 23, 6);
      break;
    case "square":
      bodyRound(7, 7, 20, 19, 1);
      break;
    case "round":
      for (let y = 5; y < 27; y++)
        for (let x = 5; x < 28; x++)
          if (((x + 0.5 - 16.5) / 10.5) ** 2 + ((y + 0.5 - 16) / 10) ** 2 <= 1)
            shape.dot(x, y, "1");
      break;
    case "octagon":
      shape.poly(
        [
          [12, 5],
          [21, 5],
          [27, 11],
          [27, 21],
          [22, 26],
          [11, 26],
          [6, 21],
          [6, 11],
        ],
        "1",
      );
      break;
    case "droplet":
      shape.poly(
        [
          [15, 4],
          [21, 6],
          [25, 11],
          [26, 20],
          [23, 25],
          [17, 27],
          [10, 25],
          [6, 21],
          [6, 14],
          [9, 10],
        ],
        "1",
      );
      break;
  }
  const inside = (x: number, y: number) => Boolean(mask[y]?.[x]);
  const inset = (x: number, y: number, amount: number) =>
    inside(x - amount, y) &&
    inside(x + amount, y) &&
    inside(x, y - amount) &&
    inside(x, y + amount);
  function panel(x: number, y: number, w: number, h: number, color: string) {
    for (let yy = y; yy < y + h; yy++)
      for (let xx = x; xx < x + w; xx++) if (inset(xx, yy, 1)) d(xx, yy, color);
  }

  // Chassis floats freely: no legs, hands, pads or connected side fins.
  switch (gear) {
    case "none":
      break;
    case "orbit":
      r(2, 16, 1, 3, accent);
      r(1, 17, 3, 1, accent);
      r(29, 13, 1, 3, secondary);
      r(28, 14, 3, 1, secondary);
      break;
    case "antenna":
      r(15, 4, 3, 5, ink);
      r(16, 4, 1, 4, accent);
      pill(14, 2, 5, 4, accent);
      r(15, 3, 2, 1, light);
      break;
    case "horns":
      r(9, 4, 3, 6, ink);
      r(22, 4, 3, 6, ink);
      pill(8, 2, 5, 4, accent);
      pill(21, 2, 5, 4, secondary);
      break;
    case "flower":
      r(15, 5, 3, 4, ink);
      r(16, 5, 1, 4, accent);
      r(14, 3, 5, 3, ink);
      r(15, 2, 3, 5, ink);
      r(15, 3, 3, 3, accent);
      d(16, 4, secondary);
      break;
  }
  // All chassis shapes use the same light direction and one-pixel contour.
  for (let y = 1; y < 31; y++)
    for (let x = 1; x < 31; x++)
      if (inside(x, y)) {
        let color = ink;
        if (inset(x, y, 1))
          color = !inset(x, y, 2)
            ? light
            : x < 11
              ? light
              : x > 22
                ? shade
                : body;
        d(x, y, color);
      }
  switch (trim) {
    case "band":
      panel(9, 23, 16, 2, secondary);
      break;
    case "belt":
      panel(8, 23, 18, 2, accent);
      panel(15, 23, 3, 2, secondary);
      break;
    case "stripe":
      panel(9, 9, 16, 1, secondary);
      panel(10, 23, 14, 1, accent);
      break;
    case "panels":
      panel(9, 12, 2, 9, accent);
      panel(23, 12, 2, 9, secondary);
      panel(13, 24, 7, 1, accent);
      break;
    case "cheeks":
      panel(9, 20, 3, 2, secondary);
      panel(22, 20, 3, 2, secondary);
      break;
  }

  // The reference's large single eye stays legible in every colourway.
  if (frame === 2) {
    r(12, 15, 9, 1, ink);
    r(13, 16, 7, 1, ink);
    r(13, 14, 7, 1, light);
  } else {
    const eyeRx = shell === "capsule" ? 4.5 : 5.5;
    ellipse(16.5, 15.5, eyeRx, 6, "#fffaf3");
    const eyeX = 15 + look + (frame === 3 ? -1 : 0);
    if (pupil === "bar") {
      r(eyeX, 12, 4, 7, ink);
      r(eyeX, 12, 2, 2, light);
      d(eyeX + 3, 17, accent);
    } else if (pupil === "round") {
      rounded(eyeX - 1, 12, 6, 7, ink, 2);
      r(eyeX, 12, 2, 2, light);
      d(eyeX + 3, 17, accent);
    } else {
      p(
        [
          [eyeX + 1, 11],
          [eyeX + 4, 14],
          [eyeX + 4, 17],
          [eyeX + 1, 20],
          [eyeX - 2, 17],
          [eyeX - 2, 14],
        ],
        ink,
      );
      r(eyeX, 13, 2, 2, light);
      d(eyeX + 2, 17, accent);
    }
  }
  // Keep particles detached from every chassis and antenna, including square bodies.
  const nodes: [number, number, string][] = [
    [1, 9, spot],
    [27, 27, secondary],
  ];
  if (satellites >= 3) nodes.push([27, 2, accent]);
  if (satellites === 4) nodes.push([1, 27, body]);
  nodes.forEach(([x, y, color], index) => {
    const offsetY = frame === 3 && index % 2 === 0 ? -1 : 0;
    const offsetX = frame === 3 && index % 2 === 1 ? (x > 16 ? -1 : 1) : 0;
    rounded(x + offsetX, y + offsetY, 4, 4, ink);
    r(x + offsetX + 1, y + offsetY + 1, 2, 2, color);
  });
  return grid;
}
