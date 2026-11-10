import type { Grid } from "./pixel-painter";

export const DETAIL_EDGE = 64;
export function mixColor(
  first: string,
  second: string,
  amount: number,
): string {
  const a = parseInt(first.slice(1), 16),
    b = parseInt(second.slice(1), 16);
  return (
    "#" +
    [16, 8, 0]
      .map((shift) =>
        Math.round(
          ((a >> shift) & 255) * (1 - amount) + ((b >> shift) & 255) * amount,
        )
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}
export function detailPainter(
  grid: Grid,
  lift = 0,
  clip?: (x: number, y: number) => boolean,
) {
  const dot = (x: number, y: number, c: string) => {
    const yy = y + lift;
    if (x > 0 && x < 63 && yy > 0 && yy < 63 && (!clip || clip(x, yy)))
      grid[yy][x] = c;
  };
  const rect = (x: number, y: number, w: number, h: number, c: string) => {
    for (let yy = y; yy < y + h; yy++)
      for (let xx = x; xx < x + w; xx++) dot(xx, yy, c);
  };
  const line = (x0: number, y0: number, x1: number, y1: number, c: string) => {
    const dx = Math.abs(x1 - x0),
      sx = x0 < x1 ? 1 : -1,
      dy = -Math.abs(y1 - y0),
      sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      dot(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e = 2 * err;
      if (e >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  };
  const ellipse = (
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    c: string,
  ) => {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++)
        if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1)
          dot(x, y, c);
  };
  const arc = (
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    start: number,
    end: number,
    c: string,
  ) => {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = x + 0.5 - cx,
          dy = y + 0.5 - cy;
        const outer = (dx / rx) ** 2 + (dy / ry) ** 2,
          inner =
            (dx / Math.max(1, rx - 1)) ** 2 + (dy / Math.max(1, ry - 1)) ** 2;
        const angle = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
        const allowed =
          start <= end
            ? angle >= start && angle <= end
            : angle >= start || angle <= end;
        if (outer <= 1 && inner >= 1 && allowed) dot(x, y, c);
      }
  };
  const poly = (points: number[][], c: string) => {
    const minX = Math.floor(Math.min(...points.map((p) => p[0]))),
      maxX = Math.ceil(Math.max(...points.map((p) => p[0])));
    const minY = Math.floor(Math.min(...points.map((p) => p[1]))),
      maxY = Math.ceil(Math.max(...points.map((p) => p[1])));
    for (let y = minY; y < maxY; y++)
      for (let x = minX; x < maxX; x++) {
        let inside = false;
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
          const [xi, yi] = points[i],
            [xj, yj] = points[j];
          if (
            yi > y + 0.5 !== yj > y + 0.5 &&
            x + 0.5 < ((xj - xi) * (y + 0.5 - yi)) / (yj - yi) + xi
          )
            inside = !inside;
        }
        if (inside) dot(x, y, c);
      }
  };
  const rivet = (x: number, y: number, c: string, ink: string) => {
    rect(x, y, 3, 3, ink);
    rect(x, y, 2, 1, c);
    dot(x + 1, y + 1, c);
  };
  return { dot, rect, line, ellipse, arc, poly, rivet };
}
export type DetailPainter = ReturnType<typeof detailPainter>;
