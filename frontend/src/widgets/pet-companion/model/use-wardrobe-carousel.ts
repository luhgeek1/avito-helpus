import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

export function useWardrobeCarousel(
  anchor: RefObject<HTMLDivElement | null>, open: boolean, initialIndex: number,
) {
  const [cursor, setCursor] = useState(initialIndex);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busy = useRef(false);
  const pending = useRef(0);
  const move = useCallback(function advance(direction: number) {
    if (!open) return;
    const step = Math.sign(direction);
    if (!step) return;
    if (busy.current) { pending.current = step; return; }
    setCursor((current) => current + step);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    busy.current = true;
    timer.current = setTimeout(() => {
      busy.current = false;
      const next = pending.current;
      pending.current = 0;
      if (next) advance(next);
    }, 280);
  }, [open]);
  useEffect(() => {
    if (open) setCursor(initialIndex);
    busy.current = false;
    pending.current = 0;
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [open, initialIndex]);
  useEffect(() => {
    const element = anchor.current;
    if (!open || !element) return;
    let accumulated = 0;
    const wheel = (event: WheelEvent) => {
      const box = element.getBoundingClientRect();
      const distance = Math.hypot(event.clientX - box.left - box.width / 2, event.clientY - box.top - box.height / 2);
      if (distance > (innerWidth <= 650 ? 210 : 260)) return;
      event.preventDefault();
      const units = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1;
      accumulated += (Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY) * units;
      if (Math.abs(accumulated) < 35) return;
      move(accumulated);
      accumulated = 0;
    };
    // Continue scrolling when a moving preview leaves the pointer over a gap in the arc.
    window.addEventListener("wheel", wheel, { passive: false });
    return () => window.removeEventListener("wheel", wheel);
  }, [anchor, open, move]);
  return { cursor, move };
}
