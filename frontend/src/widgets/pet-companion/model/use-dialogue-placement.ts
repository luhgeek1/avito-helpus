import { useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, RefObject } from "react";

type Placement = { left: number; top: number; width: number; side: string };

export function useDialoguePlacement(
  anchor: RefObject<HTMLDivElement | null>, open: boolean,
  x: CSSProperties["left"], y: CSSProperties["top"],
) {
  const ref = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);
  useLayoutEffect(() => {
    if (!open || !ref.current || !anchor.current) return;
    const update = () => {
      const panel = ref.current;
      const pet = anchor.current;
      if (!panel || !pet) return;
      const box = pet.getBoundingClientRect();
      const gap = 12;
      const leftSpace = box.left - gap - 8;
      const rightSpace = window.innerWidth - box.right - gap - 8;
      const side = leftSpace >= 180 ? "left" : rightSpace >= 180 ? "right" : "stacked";
      const space = side === "left" ? leftSpace : side === "right" ? rightSpace : window.innerWidth - 16;
      const width = Math.min(324, space);
      panel.style.width = `${width}px`;
      const height = panel.offsetHeight;
      const left = side === "left" ? box.left - gap - width
        : side === "right" ? box.right + gap
        : Math.max(8, Math.min(box.left, window.innerWidth - width - 8));
      const preferredTop = side === "stacked"
        ? box.top >= height + gap + 8 ? box.top - gap - height : box.bottom + gap
        : box.top + (box.height - height) / 2;
      const top = Math.max(8, Math.min(preferredTop, window.innerHeight - height - 8));
      const next = { left: Math.round(left), top: Math.round(top), width, side };
      setPlacement((previous) => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(ref.current);
    window.addEventListener("resize", update);
    return () => { observer.disconnect(); window.removeEventListener("resize", update); };
  }, [anchor, open, x, y]);
  const style: CSSProperties = placement
    ? { left: placement.left, top: placement.top, width: placement.width }
    : { visibility: "hidden" };
  return { ref, style, side: placement?.side };
}
