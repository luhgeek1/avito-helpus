import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { defaultPet, pets, PixelPet, pixelRuns, spriteGrid } from "@/entities/pet";

describe("pet sprites", () => {
  it("draws four distinct frames for every pet on a square grid", () => {
    expect(pets.length).toBe(40);
    for (const pet of pets) {
      const frames = [0, 1, 2, 3].map((frame) => spriteGrid(pet, frame));
      for (const grid of frames) {
        expect(grid.length).toBeGreaterThanOrEqual(32);
        expect(grid.every((row) => row.length === grid.length)).toBe(true);
        expect(pixelRuns(grid).length).toBeGreaterThan(10);
      }
      const serialized = new Set(frames.map((grid) => JSON.stringify(grid)));
      expect(serialized.size, pet.id).toBeGreaterThan(1);
    }
  });

  it("keeps the original Orbi as the default companion", () => {
    expect(defaultPet.id).toBe("orbit");
  });

  it("renders every pet as an accessible SVG, paused or animated", () => {
    for (const pet of pets) {
      const { container, unmount } = render(<PixelPet pet={pet} size={64} paused={pet.id.length % 2 === 0} />);
      expect(container.querySelector("svg")).not.toBeNull();
      unmount();
    }
  });
});
