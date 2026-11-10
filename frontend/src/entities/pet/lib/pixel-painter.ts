export type Grid = string[][];
export type Painter = ReturnType<typeof painter>;
export function painter(grid: Grid, dy = 0) {
  const dot = (x: number, y: number, c: string) => {
    if (x >= 0 && x < 32 && y + dy >= 0 && y + dy < 32) grid[y + dy][x] = c;
  };
  const rect = (x: number, y: number, w: number, h: number, c: string) => {
    for (let yy = y; yy < y + h; yy++)
      for (let xx = x; xx < x + w; xx++) dot(xx, yy, c);
  };
  const poly = (points: number[][], c: string) => {
    for (let y = 0; y < 32; y++)
      for (let x = 0; x < 32; x++) {
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
  return { dot, rect, poly };
}
export function eyes(
  p: Painter,
  x: number,
  y: number,
  gap: number,
  blink: boolean,
  ink: string,
  light = "#fff9ee",
) {
  [x, x + gap].forEach((xx) => {
    p.rect(xx, y, 2, blink ? 1 : 3, ink);
    if (!blink) p.dot(xx, y, light);
  });
}
