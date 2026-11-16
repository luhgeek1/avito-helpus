import { expect, it } from "vitest";
import { avoidChat, hasCompanionSpace } from "@/widgets/pet-companion/model/companion-boundary";

const chat = { left: 400, top: 300, width: 400, height: 300 };
const size = { width: 160, height: 128 };
const viewport = { width: 1440, height: 900 };

it.each([
  [{ x: 100, y: 350 }, { x: 1000, y: 350 }, { x: 232, y: 350 }],
  [{ x: 1000, y: 350 }, { x: 100, y: 350 }, { x: 808, y: 350 }],
  [{ x: 450, y: 100 }, { x: 450, y: 700 }, { x: 450, y: 164 }],
  [{ x: 450, y: 700 }, { x: 450, y: 100 }, { x: 450, y: 608 }],
])("stops at every chat edge even when a pointer skips the entire window", (origin, next, expected) => {
  expect(avoidChat(next, origin, size, viewport, chat)).toEqual(expected);
});

it("slides along an edge, permits moving away and allows going around a corner", () => {
  expect(avoidChat({ x: 500, y: 450 }, { x: 232, y: 350 }, size, viewport, chat)).toEqual({ x: 232, y: 450 });
  expect(avoidChat({ x: 200, y: 450 }, { x: 232, y: 450 }, size, viewport, chat)).toEqual({ x: 200, y: 450 });
  expect(avoidChat({ x: 500, y: 100 }, { x: 232, y: 100 }, size, viewport, chat)).toEqual({ x: 500, y: 100 });
  expect(avoidChat({ x: 232, y: 700 }, { x: 232, y: 100 }, size, viewport, chat)).toEqual({ x: 232, y: 700 });
});

it("moves a covered pet to the closest edge that fits the viewport", () => {
  expect(avoidChat({ x: 450, y: 590 }, null, size, viewport, chat)).toEqual({ x: 450, y: 608 });
  expect(avoidChat({ x: 450, y: 350 }, null, size, viewport, chat)).toEqual({ x: 450, y: 164 });
  const mobileChat = { left: 12, top: 200, width: 366, height: 440 };
  expect(avoidChat({ x: 230, y: 500 }, null, size, { width: 390, height: 844 }, mobileChat)).toEqual({ x: 222, y: 648 });
});

it("restores free movement when the chat is closed and clamps to the screen", () => {
  expect(avoidChat({ x: 450, y: 350 }, null, size, viewport, null)).toEqual({ x: 450, y: 350 });
  expect(avoidChat({ x: -100, y: 2000 }, null, size, viewport, null)).toEqual({ x: 8, y: 764 });
});

it("detects when a large chat leaves no space for the pet", () => {
  expect(hasCompanionSpace(size, viewport, chat)).toBe(true);
  expect(hasCompanionSpace(size, viewport, null)).toBe(true);
  expect(hasCompanionSpace(size, viewport, { left: 12, top: 12, width: 1416, height: 876 })).toBe(false);
  expect(hasCompanionSpace(size, viewport, { left: 12, top: 12, width: 400, height: 876 })).toBe(true);
});
