import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { flushSync } from "react-dom";

type Position = { x: number; y: number };
type Exit = { active: boolean; anchor: RefObject<HTMLDivElement | null>; prepare: () => void;
  land: (position: Position) => void; complete: () => void };

export function useTourExit(options: Exit) {
  const [closing, setClosing] = useState(false);
  const live = useRef(options); live.current = options;
  const running = useRef(false);
  const animation = useRef<Animation | null>(null);
  useEffect(() => {
    if (!options.active) { running.current = false; setClosing(false); }
  }, [options.active]);
  useEffect(() => () => animation.current?.cancel(), []);
  const finish = useCallback(async () => {
    if (running.current || !live.current.active) return;
    running.current = true;
    const compact = innerWidth <= 650;
    const size = compact ? 96 : 128;
    const target = { x: innerWidth - (compact ? 154 : 185), y: innerHeight - (compact ? 108 : 148) };
    const anchor = live.current.anchor.current;
    const sprite = anchor?.querySelector<SVGSVGElement>(".widget-pet .pixel-pet");
    const before = sprite?.getBoundingClientRect();
    anchor?.querySelector(".widget-pet")?.getAnimations().forEach(item => item.cancel());
    live.current.prepare(); setClosing(true);
    const oldOrigin = sprite?.style.transformOrigin ?? "";
    if (sprite && before && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const box = sprite.getBoundingClientRect();
      sprite.style.transformOrigin = "0 0";
      animation.current = sprite.animate([
        { transform: `translate3d(${before.left - box.left}px, ${before.top - box.top}px, 0)` },
        { transform: `translate3d(${target.x + ((compact ? 144 : 160) - size) / 2 - box.left}px, ${target.y - box.top}px, 0) scale(${size / box.width})` },
      ], { duration: 820, easing: "cubic-bezier(.4,0,.2,1)", fill: "forwards" });
      try { await animation.current.finished; } catch { return; }
    }
    live.current.land(target);
    animation.current?.cancel(); animation.current = null;
    if (sprite) sprite.style.transformOrigin = oldOrigin;
    flushSync(() => live.current.complete());
  }, []);
  return { closing, finish };
}
