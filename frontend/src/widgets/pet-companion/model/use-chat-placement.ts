import { useLayoutEffect, useState } from "react";
import type { CSSProperties, RefObject } from "react";

export function useChatPlacement(anchor: RefObject<HTMLDivElement | null>, position: CSSProperties) {
  const [style, setStyle] = useState<CSSProperties>({ visibility: "hidden" });
  useLayoutEffect(() => {
    function update() {
      if (!anchor.current) return;
      const box = anchor.current.getBoundingClientRect();
      const viewport = window.visualViewport;
      const vx = viewport?.offsetLeft ?? 0, vy = viewport?.offsetTop ?? 0;
      const vw = viewport?.width ?? innerWidth, vh = viewport?.height ?? innerHeight;
      const width = Math.min(360, vw - 24);
      const above = Math.max(0, Math.min(box.top - 16, vy + vh - 12) - vy - 12);
      const below = Math.max(0, vy + vh - 12 - Math.max(box.bottom + 16, vy + 12));
      const useAbove = above >= 240 || above >= below;
      const available = useAbove ? above : below;
      const height = Math.min(vw <= 650 ? 420 : 460, available >= 240 ? available : vh - 24);
      const left = Math.max(vx + 12, Math.min(box.left + box.width / 2 - width / 2, vx + vw - width - 12));
      const top = available < 240 ? vy + 12 : useAbove ? Math.min(box.top - 16, vy + vh - 12) - height : box.bottom + 16;
      setStyle({ left: Math.round(left), top: Math.round(top), width: Math.round(width), height: Math.round(height) });
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
  }, [anchor, position.left, position.top]);
  return style;
}
