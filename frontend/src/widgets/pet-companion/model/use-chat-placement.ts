import { useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, PointerEvent } from "react";

type Rect = { left: number; top: number; width: number; height: number };
type Mode = "move" | "width" | "height" | "both";
const storageKey = "buddy-chat-size";

function bounds(topInset: number) {
  const viewport = window.visualViewport;
  const left = (viewport?.offsetLeft ?? 0) + 12, top = (viewport?.offsetTop ?? 0) + topInset + 12;
  return { left, top, right: left + (viewport?.width ?? innerWidth) - 24,
    bottom: top + (viewport?.height ?? innerHeight) - topInset - 24 };
}
function clamp(rect: Rect, topInset: number): Rect {
  const b = bounds(topInset);
  const width = Math.min(rect.width, b.right - b.left), height = Math.min(rect.height, b.bottom - b.top);
  return { width, height, left: Math.round(Math.max(b.left, Math.min(rect.left, b.right - width))),
    top: Math.round(Math.max(b.top, Math.min(rect.top, b.bottom - height))) };
}

export function useChatPlacement(topInset = 0) {
  const [rect, setRect] = useState<Rect | null>(null);
  const [moving, setMoving] = useState(false);
  const manual = useRef(false);
  const drag = useRef<{ id: number; x: number; y: number; rect: Rect; mode: Mode } | null>(null);
  const preferred = useRef<{ width: number; height: number } | null>(null);
  useLayoutEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null");
      if (saved && Number.isFinite(saved.width) && Number.isFinite(saved.height)
        && saved.width >= 280 && saved.height >= 240) preferred.current = { width: saved.width, height: saved.height };
    } catch { /* Keep automatic sizing when storage is unavailable. */ }
    function update() {
      const b = bounds(topInset), mobile = b.right - b.left <= 626;
      const bottom = Math.max(b.top + Math.min(240, b.bottom - b.top), b.bottom - (mobile ? 124 : 168));
      const width = Math.min(preferred.current?.width ?? 400, b.right - b.left);
      const height = Math.min(preferred.current?.height ?? (mobile ? 440 : 520), bottom - b.top);
      setRect(previous => manual.current && previous ? clamp(previous, topInset)
        : { left: b.right - width, top: bottom - height, width, height });
    }
    update();
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    return () => {
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
    };
  }, [topInset]);

  function save(next: Rect) {
    preferred.current = { width: next.width, height: next.height };
    try { localStorage.setItem(storageKey, JSON.stringify(preferred.current)); } catch { /* Resizing still works in memory. */ }
  }
  function resize(origin: Rect, dx: number, dy: number, mode: Mode) {
    const b = bounds(topInset), right = origin.left + origin.width, bottom = origin.top + origin.height;
    const width = Math.round(Math.min(right - b.left, Math.max(280, origin.width - (mode === "height" ? 0 : dx))));
    const height = Math.round(Math.min(bottom - b.top, Math.max(240, origin.height - (mode === "width" ? 0 : dy))));
    return { left: right - width, top: bottom - height, width, height };
  }
  function end(event: PointerEvent<HTMLElement>) {
    const start = drag.current;
    if (!start || start.id !== event.pointerId) return;
    if (start.mode !== "move" && rect) save(rect);
    drag.current = null;
    setMoving(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function handles(mode: Mode) {
    return {
      onPointerDown(event: PointerEvent<HTMLElement>) {
        if (!rect || !event.isPrimary || event.button !== 0) return;
        if (mode === "move" && event.target instanceof Element && event.target.closest("button")) return;
        event.preventDefault();
        event.currentTarget.focus({ preventScroll: true });
        drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, rect, mode };
        setMoving(mode === "move");
        event.currentTarget.setPointerCapture(event.pointerId);
      },
      onPointerMove(event: PointerEvent<HTMLElement>) {
        const start = drag.current;
        if (!start || start.id !== event.pointerId) return;
        const dx = event.clientX - start.x, dy = event.clientY - start.y;
        if (Math.hypot(dx, dy) < 4) return;
        manual.current = true;
        setRect(start.mode === "move" ? clamp({ ...start.rect, left: start.rect.left + dx, top: start.rect.top + dy }, topInset)
          : resize(start.rect, dx, dy, start.mode));
      },
      onPointerUp: end, onPointerCancel: end, onLostPointerCapture: end,
      onKeyDown(event: KeyboardEvent<HTMLElement>) {
        if (!rect || event.target !== event.currentTarget) return;
        const step = event.shiftKey ? 32 : 16;
        const dx = mode !== "height" ? ({ ArrowLeft: -step, ArrowRight: step }[event.key] ?? 0) : 0;
        const dy = mode !== "width" ? ({ ArrowUp: -step, ArrowDown: step }[event.key] ?? 0) : 0;
        if (!dx && !dy) return;
        event.preventDefault();
        manual.current = true;
        const next = mode === "move" ? clamp({ ...rect, left: rect.left + dx, top: rect.top + dy }, topInset) : resize(rect, dx, dy, mode);
        setRect(next);
        if (mode !== "move") save(next);
      },
    };
  }
  const style: CSSProperties = rect ?? { visibility: "hidden" };
  return { style, handles, moving };
}
