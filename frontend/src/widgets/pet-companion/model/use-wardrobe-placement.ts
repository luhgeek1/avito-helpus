import { useEffect, useState } from "react";
import type { CSSProperties, RefObject } from "react";

export type WardrobePlacement = {
  cx: number; cy: number; size: number; radius: number;
  horizontal: number; vertical: number; semicircle?: boolean;
};
export function useWardrobePlacement(
  anchor: RefObject<HTMLDivElement | null>, position: CSSProperties, semicircle = false,
) {
  const [layout, setLayout] = useState<WardrobePlacement | null>(null);
  useEffect(() => {
    const update = () => {
      if (!anchor.current) return;
      const box = anchor.current.getBoundingClientRect();
      const cx = box.left + box.width / 2, cy = box.top + box.height / 2;
      const compact = innerWidth <= 650;
      const scale = Math.max(1, box.width / (compact ? 144 : 160));
      const baseSize = (compact ? 56 : 64) * scale;
      if (semicircle) {
        const size = compact ? 48 : 112;
        const radius = Math.max(64, Math.min(compact ? 210 : 330,
          innerWidth - cx - size / 2 - 16, cy - size / 2 - 68, innerHeight - cy - size / 2 - 16));
        setLayout({ cx, cy, size, radius, horizontal: 1, vertical: 1, semicircle: true });
        return;
      }
      const horizontal = cx >= innerWidth / 2 ? -1 : 1;
      const vertical = cy >= innerHeight / 2 ? -1 : 1;
      const horizontalSpace = horizontal < 0 ? cx : innerWidth - cx;
      const verticalSpace = vertical < 0 ? cy : innerHeight - cy;
      const oppositeSpace = horizontal < 0 ? innerWidth - cx : cx;
      const radius = Math.max(64, Math.min((compact ? 124 : 146) * scale,
        horizontalSpace - baseSize / 2 - 16,
        verticalSpace - baseSize / 2 - 16,
        (oppositeSpace - baseSize / 2 - 16) / Math.sin(Math.PI / 30)));
      const size = Math.max(40, Math.min(baseSize, Math.floor(radius * .4 / 4) * 4));
      setLayout({ cx, cy, size, radius, horizontal, vertical });
    };
    update();
    const observer = new ResizeObserver(update);
    if (anchor.current) observer.observe(anchor.current);
    window.addEventListener("resize", update);
    return () => { observer.disconnect(); window.removeEventListener("resize", update); };
  }, [anchor, position.left, position.top, semicircle]);
  return layout;
}
