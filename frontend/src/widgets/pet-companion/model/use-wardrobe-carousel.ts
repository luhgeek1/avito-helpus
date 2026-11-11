import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

export function useWardrobeCarousel(
  anchor: RefObject<HTMLDivElement | null>, open: boolean, initialIndex: number,
) {
  const [cursor, setCursor] = useState(initialIndex);
  const motion = useRef({ position: initialIndex, target: initialIndex, velocity: 0, time: 0 });
  const frame = useRef<number | null>(null);
  const move = useCallback((direction: number) => {
    if (!open) return;
    const step = Math.sign(direction);
    if (!step) return;
    const state = motion.current;
    state.target += step;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
      state.position = state.target;
      state.velocity = 0;
      setCursor(state.target);
      return;
    }
    if (frame.current !== null) return;
    state.time = performance.now();
    function animate(time: number) {
      const dt = Math.min((time - state.time) / 1000, .04);
      state.time = time;
      // Analytic critical damping preserves velocity when input retargets the arc.
      const distance = state.position - state.target;
      const impulse = state.velocity + 16 * distance;
      const decay = Math.exp(-16 * dt);
      state.position = state.target + (distance + impulse * dt) * decay;
      state.velocity = (state.velocity - 16 * impulse * dt) * decay;
      const settled = Math.abs(state.position - state.target) < .001 && Math.abs(state.velocity) < .01;
      setCursor(settled ? state.target : state.position);
      frame.current = settled ? null : requestAnimationFrame(animate);
    }
    frame.current = requestAnimationFrame(animate);
  }, [open]);
  useEffect(() => {
    if (open) setCursor(initialIndex);
    motion.current = { position: initialIndex, target: initialIndex, velocity: 0, time: 0 };
    frame.current = null;
    return () => { if (frame.current !== null) cancelAnimationFrame(frame.current); };
  }, [open, initialIndex]);
  useEffect(() => {
    const element = anchor.current;
    if (!open || !element) return;
    let accumulated = 0;
    const wheel = (event: WheelEvent) => {
      const box = element.getBoundingClientRect();
      const distance = Math.hypot(event.clientX - box.left - box.width / 2, event.clientY - box.top - box.height / 2);
      const scale = Math.max(1, box.width / (innerWidth <= 650 ? 144 : 160));
      if (distance > (innerWidth <= 650 ? 210 : 260) * scale) return;
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
