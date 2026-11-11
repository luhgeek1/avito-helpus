import { useRef } from "react";
import type { PointerEvent } from "react";

export function useWardrobeGesture(move: (direction: number) => void) {
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const swiped = useRef(false);
  function end(event: PointerEvent<HTMLDivElement>) {
    const origin = start.current;
    if (!origin || origin.id !== event.pointerId) return;
    const dx = event.clientX - origin.x;
    const dy = event.clientY - origin.y;
    if (event.type !== "pointercancel" && Math.hypot(dx, dy) >= 20) {
      swiped.current = true;
      move(-(Math.abs(dx) >= Math.abs(dy) ? dx : dy));
    }
    start.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  return {
    handlers: {
      onPointerDown(event: PointerEvent<HTMLDivElement>) {
        if (!event.isPrimary || event.button !== 0) return;
        swiped.current = false;
        start.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
      },
      onPointerMove(event: PointerEvent<HTMLDivElement>) {
        const origin = start.current;
        if (origin?.id === event.pointerId && Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > 10) {
          event.currentTarget.setPointerCapture(event.pointerId);
        }
      },
      onPointerUp: end, onPointerCancel: end,
    },
    consumeSwipe() { const value = swiped.current; swiped.current = false; return value; },
  };
}
