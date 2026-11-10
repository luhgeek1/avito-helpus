import { pixelRuns, spriteGrid } from "@/entities/pet";
import type { Pet } from "@/entities/pet";
export function downloadSprite(pet: Pet) {
  const grid = spriteGrid(pet, 0);
  const edge = grid.length;
  const rects = pixelRuns(grid)
    .map(
      (r) =>
        `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="1" fill="${r.color}"/>`,
    )
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 ${edge} ${edge}" shape-rendering="crispEdges">${rects}</svg>`;
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `avito-buddy-${pet.id}.svg`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
