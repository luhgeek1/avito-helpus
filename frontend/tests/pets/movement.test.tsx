import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { KeyboardEvent, PointerEvent } from "react";
import { useChatPlacement } from "@/widgets/pet-companion/model/use-chat-placement";
import { useCompanionPosition } from "@/widgets/pet-companion/model/use-companion-position";
import { useSpotlightPosition } from "@/widgets/pet-companion/model/use-spotlight-position";
import { useWardrobeGesture } from "@/widgets/pet-companion/model/use-wardrobe-gesture";
import { useWardrobeCarousel } from "@/widgets/pet-companion/model/use-wardrobe-carousel";
import { useRadialTransition } from "@/widgets/pet-companion/model/use-radial-transition";
import { useTypewriter } from "@/widgets/pet-companion/model/use-typewriter";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

function element() {
  const el = document.createElement("button");
  Object.defineProperties(el, { offsetWidth: { value: 160 }, offsetHeight: { value: 128 },
    offsetLeft: { value: 100 }, offsetTop: { value: 200 } });
  el.hasPointerCapture = () => true;
  return el;
}

function pointer(el: HTMLElement, x = 0, y = 0, type = "pointermove") {
  return { isPrimary: true, button: 0, pointerId: 1, clientX: x, clientY: y, type,
    currentTarget: el, target: el, preventDefault: vi.fn(), stopPropagation: vi.fn() } as unknown as PointerEvent<HTMLButtonElement>;
}
function key(el: HTMLElement, name: string, shiftKey = false) {
  return { currentTarget: el, target: el, key: name, shiftKey, preventDefault: vi.fn() } as unknown as KeyboardEvent<HTMLButtonElement>;
}

it.each([320, 375, 390, 430, 812])("keeps the chat inside a %ipx visual viewport during movement and resizing", (width) => {
  const viewport = Object.assign(new EventTarget(), { width, height: width === 812 ? 375 : 812, offsetLeft: 0, offsetTop: 0 });
  vi.stubGlobal("visualViewport", viewport);
  localStorage.setItem("buddy-chat-size", JSON.stringify({ width: 400, height: 520 }));
  const { result, unmount } = renderHook(() => useChatPlacement());
  const el = element();
  const inside = () => {
    const r = result.current.style;
    expect(Number(r.left)).toBeGreaterThanOrEqual(12);
    expect(Number(r.top)).toBeGreaterThanOrEqual(12);
    expect(Number(r.left) + Number(r.width)).toBeLessThanOrEqual(width - 12);
    expect(Number(r.top) + Number(r.height)).toBeLessThanOrEqual(viewport.height - 12);
  };
  inside();
  act(() => result.current.handles("move").onKeyDown(key(el, "ArrowLeft", true)));
  act(() => result.current.handles("move").onPointerDown(pointer(el, 100, 100)));
  // A header is not a button; its controls must retain ordinary clicks.
  const header = document.createElement("header");
  act(() => result.current.handles("move").onPointerDown(pointer(header, 100, 100)));
  act(() => result.current.handles("move").onPointerMove(pointer(header, -2000, 2000)));
  expect(result.current.moving).toBe(true);
  inside();
  act(() => result.current.handles("move").onPointerUp(pointer(header)));
  expect(result.current.moving).toBe(false);
  for (const mode of ["width", "height", "both"] as const) {
    act(() => result.current.handles(mode).onKeyDown(key(el, "ArrowUp")));
    act(() => result.current.handles(mode).onKeyDown(key(el, "ArrowLeft", true)));
    act(() => result.current.handles(mode).onPointerDown(pointer(el, 100, 100)));
    act(() => result.current.handles(mode).onPointerMove(pointer(el, 50, 50)));
    act(() => result.current.handles(mode).onPointerUp(pointer(el)));
    inside();
    expect(JSON.parse(localStorage.getItem("buddy-chat-size")!)).toMatchObject({ width: result.current.style.width, height: result.current.style.height });
  }
  act(() => viewport.dispatchEvent(new Event("resize")));
  inside();
  unmount();
});

it("still moves and resizes chat when saved size is corrupted or storage is blocked", () => {
  localStorage.setItem("buddy-chat-size", "bad json");
  const { result } = renderHook(() => useChatPlacement(56));
  expect(Number(result.current.style.top)).toBeGreaterThanOrEqual(68);
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
  act(() => result.current.handles("width").onKeyDown(key(element(), "ArrowRight")));
  expect(Number(result.current.style.width)).toBe(384);
});

it("drags the pet with a threshold, suppresses the resulting click and persists keyboard movement", () => {
  const el = element();
  const { result } = renderHook(() => {
    const hook = useCompanionPosition(true);
    hook.ref.current = el as unknown as HTMLDivElement;
    return hook;
  });
  act(() => result.current.handlers.onPointerDown(pointer(el, 10, 10)));
  act(() => result.current.handlers.onPointerMove(pointer(el, 11, 11)));
  expect(result.current.dragging).toBe(false);
  act(() => result.current.handlers.onPointerMove(pointer(el, 30, 40)));
  expect(result.current.style).toMatchObject({ left: 120, top: 230 });
  expect(result.current.dragging).toBe(true);
  act(() => result.current.handlers.onPointerUp(pointer(el, 30, 40)));
  expect(result.current.dragging).toBe(false);
  expect(result.current.consumeDragClick()).toBe(true);
  expect(result.current.consumeDragClick()).toBe(false);
  act(() => result.current.handlers.onKeyDown(key(el, "ArrowRight", true)));
  expect(JSON.parse(localStorage.getItem("buddy-position")!)).toEqual({ x: 132, y: 200 });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
  act(() => result.current.handlers.onKeyDown(key(el, "ArrowDown")));
  expect(result.current.style.top).toBe(216);
  act(() => result.current.relocate({ x: -100, y: -200 }));
  expect(result.current.style).toMatchObject({ left: 8, top: 8 });
});

it("recovers a pet position from malformed browser storage", () => {
  localStorage.setItem("buddy-position", "broken");
  const { result } = renderHook(() => useCompanionPosition(false));
  expect(result.current.style).toEqual({});
});

it("moves Spotlight independently and suppresses submitting after a pointer drag", () => {
  const el = element();
  localStorage.setItem("buddy-spotlight-position", "broken");
  const { result } = renderHook(() => {
    const hook = useSpotlightPosition(); hook.ref.current = el; return hook;
  });
  const initial = Number(result.current.style.left);
  act(() => result.current.handlers.onPointerDown(pointer(el, 10, 10)));
  act(() => result.current.handlers.onPointerMove(pointer(el, 12, 12)));
  expect(result.current.style.left).toBe(initial);
  act(() => result.current.handlers.onPointerMove(pointer(el, 30, 40)));
  expect(result.current.style.left).toBe(initial + 20);
  act(() => result.current.handlers.onPointerUp(pointer(el)));
  expect(localStorage.getItem("buddy-spotlight-position")).not.toBeNull();
  const click = { detail: 1, preventDefault: vi.fn(), stopPropagation: vi.fn() };
  result.current.handlers.onClickCapture(click as never);
  expect(click.preventDefault).toHaveBeenCalled();
  act(() => result.current.handlers.onKeyDown(key(el, "ArrowLeft", true)));
  expect(result.current.style.left).toBe(initial - 12);
  act(() => window.dispatchEvent(new Event("resize")));
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
  act(() => result.current.handlers.onKeyDown(key(el, "ArrowUp")));
  expect(Number(result.current.style.top)).toBeGreaterThanOrEqual(8);
});

it("distinguishes a wardrobe swipe from a tap and a cancelled gesture", () => {
  const move = vi.fn(), el = element();
  const { result } = renderHook(() => useWardrobeGesture(move));
  const event = (x: number, y: number, type?: string) => pointer(el, x, y, type) as unknown as PointerEvent<HTMLDivElement>;
  act(() => result.current.handlers.onPointerDown(event(0, 0)));
  act(() => result.current.handlers.onPointerMove(event(30, 0)));
  act(() => result.current.handlers.onPointerUp(event(60, 0, "pointerup")));
  expect(move).toHaveBeenCalledWith(-60);
  expect(result.current.consumeSwipe()).toBe(true);
  expect(result.current.consumeSwipe()).toBe(false);
  act(() => result.current.handlers.onPointerDown(event(0, 0)));
  act(() => result.current.handlers.onPointerCancel(event(0, 60, "pointercancel")));
  expect(move).toHaveBeenCalledTimes(1);
});

it("makes radial menus interactive after transition and immediately with reduced motion", () => {
  vi.useFakeTimers();
  const { result, rerender } = renderHook(({ open }) => useRadialTransition(open), { initialProps: { open: true } });
  expect(result.current.interactive).toBe(false);
  const el = element();
  act(() => result.current.onTransitionEnd({ target: el, currentTarget: el, propertyName: "transform" } as never));
  expect(result.current.interactive).toBe(true);
  rerender({ open: false });
  expect(result.current.interactive).toBe(false);
  vi.spyOn(window, "matchMedia").mockReturnValue({ matches: true } as MediaQueryList);
  rerender({ open: true });
  expect(result.current.interactive).toBe(true);
});

it("stops carousel animation and moves directly when reduced motion becomes enabled", () => {
  const { result } = renderHook(() => useWardrobeCarousel({ current: document.createElement("div") }, true, 2));
  act(() => result.current.move(1));
  vi.spyOn(window, "matchMedia").mockReturnValue({ matches: true } as MediaQueryList);
  act(() => result.current.move(1));
  expect(result.current.cursor).toBe(4);
});

it("types punctuation with pauses, can reveal the reply, and restarts an identical reply", () => {
  vi.useFakeTimers();
  const { result, rerender } = renderHook(({ id, paused }) => useTypewriter("Hi, there!", true, paused, id), { initialProps: { id: "a", paused: false } });
  act(() => vi.advanceTimersByTime(2000));
  expect(result.current.displayed).toBe("Hi, there!");
  expect(result.current.typing).toBe(false);
  rerender({ id: "b", paused: false });
  expect(result.current.displayed).toBe("");
  act(() => result.current.complete());
  act(() => vi.advanceTimersByTime(200));
  expect(result.current.displayed).toBe("Hi, there!");
  rerender({ id: "c", paused: true });
  expect(result.current.typing).toBe(false);
});
