import { useEffect, useState } from "react";
import type { CSSProperties, RefObject } from "react";
import { useOrbitPlacement } from "../model/use-orbit-placement";
import { PixelActionIcon } from "./pixel-action-icon";
import type { CompanionAction } from "./pixel-action-icon";

const actions: { id: CompanionAction; label: string; color: string }[] = [
  { id: "chat", label: "Чат", color: "#d8f4ff" },
  { id: "wardrobe", label: "Гардероб", color: "#eee1ff" },
  { id: "settings", label: "Настройки", color: "#ffe2ed" },
];
const outline = "M16 0h24v4h8v4h4v8h4v24h-4v8h-4v4h-8v4H16v-4H8v-4H4v-8H0V16h4V8h4V4h8z";

export function CompanionOrbitMenu({ anchor, position, open, onAction }: {
  anchor: RefObject<HTMLDivElement | null>;
  position: CSSProperties;
  open: boolean;
  onAction: (action: CompanionAction) => void;
}) {
  const orbit = useOrbitPlacement(anchor, position.left, position.top);
  const [interactive, setInteractive] = useState(false);
  useEffect(() => {
    setInteractive(false);
    if (!open) return;
    const delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 360;
    const timer = setTimeout(() => setInteractive(true), delay);
    return () => clearTimeout(timer);
  }, [open]);
  return (
    <div id="companion-actions" className="companion-orbit-menu" role="group" aria-label="Действия спутника"
      aria-hidden={!open} inert={!open || !interactive}>
      {orbit && actions.map((action, index) => (
        <button key={action.id} type="button" aria-label={action.label} onClick={() => onAction(action.id)}
          className={`orbit-action fixed z-38 flex flex-col items-center gap-[5px] bg-transparent p-0 text-[#383c62]
            outline-none [transition:transform_280ms_cubic-bezier(.22,1,.36,1),opacity_180ms_ease]
            motion-reduce:transition-none hover:[&_svg.orbit-disc]:brightness-105
            focus-visible:[&_.orbit-disc]:drop-shadow-[0_0_3px_#00aaff]
            ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
          style={{ left: orbit.origin.x - 4, top: orbit.origin.y, width: orbit.size + 8,
            transform: open ? `translate(${orbit.offsets[index].x}px, ${orbit.offsets[index].y}px) scale(1)` : "translate(0, 0) scale(.35)",
            transitionDelay: open ? `${index * 40}ms` : `${(2 - index) * 20}ms`,
          }}>
          <span className="relative grid aspect-square place-items-center" style={{ width: orbit.size, height: orbit.size }}>
            <svg className="orbit-disc absolute inset-0 size-full overflow-visible [filter:drop-shadow(2px_3px_0_#383c6218)]"
              viewBox="0 0 56 56" shapeRendering="crispEdges" aria-hidden="true">
              <path d={outline} fill="#383c62" />
              <path d={outline} transform="translate(3 3) scale(.892857)" fill={action.color} />
              <path d="M16 7h24v3H16z M10 11h5v3h-5z" fill="#ffffff" fillOpacity=".85" />
            </svg>
            <span className="relative"><PixelActionIcon action={action.id} /></span>
          </span>
          <span className="whitespace-nowrap bg-[#f7f8fa]/95 px-1 py-[2px] font-pixel text-[7px] leading-[1.4] max-sm:text-[6px]">
            {action.label}
          </span>
        </button>
      ))}
    </div>
  );
}
