import { useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, PointerEvent } from "react";

type Position = { x: number; y: number };
const storageKey = "buddy-position";

function readPosition(): Position | null {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) ?? "null");
    return value && Number.isFinite(value.x) && Number.isFinite(value.y)
      ? { x: value.x, y: value.y }
      : null;
  } catch {
    return null;
  }
}

function savePosition(position: Position) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(position));
  } catch {
    // Dragging remains available when browser storage is disabled.
  }
}

export function useCompanionPosition(visible: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<Position | null>(readPosition);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{
    id: number; x: number; y: number; origin: Position; moved: boolean;
  } | null>(null);
  const suppressClick = useRef(false);

  function clamp(next: Position): Position {
    const element = ref.current;
    return {
      x: Math.round(Math.max(8, Math.min(next.x, window.innerWidth - (element?.offsetWidth ?? 160) - 8))),
      y: Math.round(Math.max(8, Math.min(next.y, window.innerHeight - (element?.offsetHeight ?? 128) - 8))),
    };
  }

  useLayoutEffect(() => {
    if (!visible || !ref.current) return;
    const update = () => {
      const element = ref.current;
      if (!element) return;
      setPosition((previous) =>
        clamp(previous ?? { x: element.offsetLeft, y: element.offsetTop }),
      );
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [visible]);

  function onPointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (!event.isPrimary || event.button !== 0 || !ref.current) return;
    suppressClick.current = false;
    const element = ref.current;
    drag.current = {
      id: event.pointerId, x: event.clientX, y: event.clientY,
      origin: { x: element.offsetLeft, y: element.offsetTop }, moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent<HTMLButtonElement>) {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;
    if (!current.moved && Math.hypot(dx, dy) < 5) return;
    current.moved = true;
    suppressClick.current = true;
    setDragging(true);
    setPosition(clamp({ x: current.origin.x + dx, y: current.origin.y + dy }));
  }

  function onPointerEnd(event: PointerEvent<HTMLButtonElement>) {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    if (current.moved && ref.current) {
      savePosition(clamp({ x: ref.current.offsetLeft, y: ref.current.offsetTop }));
    }
    drag.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (!direction || !ref.current) return;
    event.preventDefault();
    const step = event.shiftKey ? 32 : 16;
    const next = clamp({ x: ref.current.offsetLeft + direction[0] * step, y: ref.current.offsetTop + direction[1] * step });
    setPosition(next);
    savePosition(next);
  }

  const style: CSSProperties = position ? { left: position.x, top: position.y, right: "auto", bottom: "auto" } : {};
  return {
    ref, style, dragging,
    handlers: { onPointerDown, onPointerMove, onPointerUp: onPointerEnd, onPointerCancel: onPointerEnd, onLostPointerCapture: onPointerEnd, onKeyDown },
    consumeDragClick() {
      const suppressed = suppressClick.current;
      suppressClick.current = false;
      return suppressed;
    },
  };
}
