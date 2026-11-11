import { useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent, PointerEvent } from "react";

type Position = { x: number; y: number };
const storageKey = "buddy-spotlight-position";

export function useSpotlightPosition() {
  const ref = useRef<HTMLElement>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const drag = useRef<{ id: number; x: number; y: number; origin: Position; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  function clamp(next: Position) {
    const viewport = window.visualViewport;
    const x = viewport?.offsetLeft ?? 0, y = viewport?.offsetTop ?? 0;
    const width = viewport?.width ?? innerWidth, height = viewport?.height ?? innerHeight;
    return {
      x: Math.round(Math.max(x + 8, Math.min(next.x, x + width - (ref.current?.offsetWidth ?? 0) - 8))),
      y: Math.round(Math.max(y + 8, Math.min(next.y, y + height - (ref.current?.offsetHeight ?? 0) - 8))),
    };
  }
  function save(next: Position) {
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {
      // Moving the panel remains available without browser storage.
    }
  }
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    let saved: Position | null = null;
    try {
      const value = JSON.parse(localStorage.getItem(storageKey) ?? "null");
      if (value && Number.isFinite(value.x) && Number.isFinite(value.y)) saved = value;
    } catch { /* Use the initial centered position. */ }
    setPosition(clamp(saved ?? { x: (innerWidth - element.offsetWidth) / 2, y: innerHeight * .22 }));
    const update = () => setPosition(previous => {
      if (!previous) return previous;
      const next = clamp(previous);
      return previous.x === next.x && previous.y === next.y ? previous : next;
    });
    const observer = new ResizeObserver(update);
    observer.observe(element);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);
  function onPointerDown(event: PointerEvent<HTMLElement>) {
    if (!event.isPrimary || event.button !== 0 || !position) return;
    suppressClick.current = false;
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, origin: position, moved: false };
    // Capture on the original target so ordinary input and button clicks still work.
    const target = event.target instanceof Element ? event.target : event.currentTarget;
    target.setPointerCapture(event.pointerId);
  }
  function onPointerMove(event: PointerEvent<HTMLElement>) {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    const dx = event.clientX - current.x, dy = event.clientY - current.y;
    if (!current.moved && Math.hypot(dx, dy) < 5) return;
    if (!current.moved) {
      current.moved = true;
      suppressClick.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    event.preventDefault();
    setPosition(clamp({ x: current.origin.x + dx, y: current.origin.y + dy }));
  }
  function onPointerEnd(event: PointerEvent<HTMLElement>) {
    if (event.type === "lostpointercapture" && event.target !== event.currentTarget) return;
    if (drag.current?.id !== event.pointerId) return;
    if (drag.current.moved && position) save(position);
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function onClickCapture(event: MouseEvent<HTMLElement>) {
    if (!suppressClick.current || event.detail === 0) return;
    suppressClick.current = false;
    event.preventDefault();
    event.stopPropagation();
  }
  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (!direction || !position) return;
    event.preventDefault();
    const step = event.shiftKey ? 32 : 16;
    const next = clamp({ x: position.x + direction[0] * step, y: position.y + direction[1] * step });
    setPosition(next); save(next);
  }
  return { ref, style: position ? { left: position.x, top: position.y } : { visibility: "hidden" as const },
    handlers: { onPointerDown, onPointerMove, onPointerUp: onPointerEnd, onPointerCancel: onPointerEnd, onLostPointerCapture: onPointerEnd, onClickCapture, onKeyDown } };
}
