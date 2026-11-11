import { useEffect, useState } from "react";
import type { CSSProperties, RefObject } from "react";

type Orbit = { origin: { x: number; y: number }; offsets: { x: number; y: number }[]; size: number };

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
      const size = compact ? 40 : 44;
      const radius = compact ? 128 : 140;
      const cx = box.left + box.width / 2;
      const cy = box.top + box.height / 2;
      const horizontal = cx >= window.innerWidth / 2 ? -1 : 1;
      const vertical = cy >= window.innerHeight / 2 ? -1 : 1;
      const origin = { x: cx - size / 2, y: cy - size / 2 };
      const offsets = [[1, 0], [Math.SQRT1_2, Math.SQRT1_2], [0, 1]].map(([dx, dy]) => {
        const left = Math.max(18, Math.min(origin.x + horizontal * radius * dx, window.innerWidth - size - 18));
        const top = Math.max(12, Math.min(origin.y + vertical * radius * dy, window.innerHeight - size - 32));
        return { x: left - origin.x, y: top - origin.y };
      });
      setOrbit({ origin, offsets, size });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [anchor, x, y]);
  return orbit;
}
