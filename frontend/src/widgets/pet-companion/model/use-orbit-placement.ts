import { useEffect, useState } from "react";
import type { CSSProperties, RefObject } from "react";

type Orbit = {
  origin: { x: number; y: number }; offsets: { x: number; y: number }[]; size: number; scale: number;
  thought: { left: number; top: number; size: number; flipX: boolean; flipY: boolean };
};

export function useOrbitPlacement(
  anchor: RefObject<HTMLDivElement | null>,
  x: CSSProperties["left"], y: CSSProperties["top"],
) {
  const [orbit, setOrbit] = useState<Orbit | null>(null);
  // The parent DOM ref is attached before passive effects, including restored-position mounts.
  useEffect(() => {
    const update = () => {
      if (!anchor.current) return;
      const box = anchor.current.getBoundingClientRect();
      const compact = window.innerWidth <= 650;
      const scale = Math.max(1, box.width / (compact ? 144 : 160));
      const size = (compact ? 40 : 44) * scale;
      const radius = (compact ? 140 : 152) * scale;
      const cx = box.left + box.width / 2;
      const cy = box.top + box.height / 2;
      const horizontal = cx >= window.innerWidth / 2 ? -1 : 1;
      const vertical = cy >= window.innerHeight / 2 ? -1 : 1;
      const origin = { x: cx - size / 2, y: cy - size / 2 };
      const offsets = [0, Math.PI / 6, Math.PI / 3, Math.PI / 2].map(angle => {
        const dx = Math.cos(angle), dy = Math.sin(angle);
        const left = Math.max(18, Math.min(origin.x + horizontal * radius * dx, window.innerWidth - size - 18));
        const top = Math.max(12, Math.min(origin.y + vertical * radius * dy, window.innerHeight - size - 32));
        return { x: left - origin.x, y: top - origin.y };
      });
      const thoughtSize = (compact ? 48 : 56) * scale;
      const thought = {
        left: horizontal < 0 ? box.left + 8 * scale : box.right - thoughtSize - 8 * scale,
        top: vertical < 0 ? box.top - thoughtSize + 28 * scale : box.bottom - 28 * scale,
        size: thoughtSize, flipX: horizontal > 0, flipY: vertical > 0,
      };
      thought.left = Math.max(8, Math.min(thought.left, innerWidth - thoughtSize - 8));
      thought.top = Math.max(8, Math.min(thought.top, innerHeight - thoughtSize - 8));
      setOrbit({ origin, offsets, size, scale, thought });
    };
    update();
    const observer = new ResizeObserver(update);
    if (anchor.current) observer.observe(anchor.current);
    window.addEventListener("resize", update);
    return () => { observer.disconnect(); window.removeEventListener("resize", update); };
  }, [anchor, x, y]);
  return orbit;
}
