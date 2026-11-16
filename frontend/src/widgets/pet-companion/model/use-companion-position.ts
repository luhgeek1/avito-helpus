import { useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, PointerEvent } from "react";
import { avoidChat, hasCompanionSpace, type ChatBoundary } from "./companion-boundary";

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

export function useCompanionPosition(visible: boolean, chat: ChatBoundary | null = null) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<Position | null>(readPosition);
  const [dragging, setDragging] = useState(false);
  const [obstructed, setObstructed] = useState(false);
  const drag = useRef<{
    id: number; x: number; y: number; origin: Position; moved: boolean;
  } | null>(null);
  const suppressClick = useRef(false);

  function clamp(next: Position, origin: Position | null = null): Position {
    const element = ref.current;
    return avoidChat(next, origin, { width: element?.offsetWidth ?? 160, height: element?.offsetHeight ?? 128 },
      { width: window.innerWidth, height: window.innerHeight }, chat);
  }

  useLayoutEffect(() => {
    if (!visible || !ref.current) return;
    const update = () => {
      const element = ref.current;
      if (!element) return;
      setObstructed(!hasCompanionSpace({ width: element.offsetWidth, height: element.offsetHeight },
        { width: window.innerWidth, height: window.innerHeight }, chat));
      setPosition(previous => {
        const next = clamp(previous ?? { x: element.offsetLeft, y: element.offsetTop });
        return previous?.x === next.x && previous.y === next.y ? previous : next;
      });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [visible, chat]);

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
    setPosition(previous => clamp({ x: current.origin.x + dx, y: current.origin.y + dy }, previous ?? current.origin));
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
    const origin = { x: ref.current.offsetLeft, y: ref.current.offsetTop };
    const next = clamp({ x: origin.x + direction[0] * step, y: origin.y + direction[1] * step }, origin);
    setPosition(next);
    savePosition(next);
  }

  const style: CSSProperties = position ? { left: position.x, top: position.y, right: "auto", bottom: "auto" } : {};
  return {
    ref, style, dragging, obstructed,
    relocate: (next: Position) => setPosition(clamp(next)),
    handlers: { onPointerDown, onPointerMove, onPointerUp: onPointerEnd, onPointerCancel: onPointerEnd, onLostPointerCapture: onPointerEnd, onKeyDown },
    consumeDragClick() {
      const suppressed = suppressClick.current;
      suppressClick.current = false;
      return suppressed;
    },
  };
}
