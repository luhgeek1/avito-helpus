import { useEffect, useState } from "react";
import type { CSSProperties, RefObject } from "react";

export type WardrobePlacement = {
  cx: number; cy: number; size: number; radius: number;
  horizontal: number; vertical: number; controls: { left: number; top: number };
};
export function useWardrobePlacement(
  anchor: RefObject<HTMLDivElement | null>, position: CSSProperties,
) {
  const [layout, setLayout] = useState<WardrobePlacement | null>(null);
  useEffect(() => {
    const update = () => {
      if (!anchor.current) return;
      const box = anchor.current.getBoundingClientRect();
      const cx = box.left + box.width / 2, cy = box.top + box.height / 2;
      const compact = innerWidth <= 650;
      const baseSize = compact ? 56 : 64;
      const horizontal = cx >= innerWidth / 2 ? -1 : 1;
      const vertical = cy >= innerHeight / 2 ? -1 : 1;
      const horizontalSpace = horizontal < 0 ? cx : innerWidth - cx;
      const verticalSpace = vertical < 0 ? cy : innerHeight - cy;
      const oppositeSpace = horizontal < 0 ? innerWidth - cx : cx;
      const radius = Math.max(64, Math.min(compact ? 150 : 188,
        horizontalSpace - baseSize / 2 - 16,
        verticalSpace - baseSize / 2 - 16,
        (oppositeSpace - baseSize / 2 - 16) / Math.sin(Math.PI / 18)));
      const size = Math.max(40, Math.min(baseSize, Math.floor(radius * .4 / 4) * 4));
      const controls = {
        left: Math.max(8, Math.min(cx + horizontal * radius * .75 - (horizontal > 0 ? 80 : 0), innerWidth - 88)),
        top: Math.max(8, Math.min(cy + (vertical < 0 ? 16 : -52), innerHeight - 44)),
      };
      setLayout({ cx, cy, size, radius, horizontal, vertical, controls });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [anchor, position.left, position.top]);
  return layout;
}
