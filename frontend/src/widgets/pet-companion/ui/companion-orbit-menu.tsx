import type { CSSProperties, RefObject } from "react";
import { cx } from "@/shared/lib/cx";
import { useOrbitPlacement } from "../model/use-orbit-placement";
import { useRadialTransition } from "../model/use-radial-transition";
import { PixelActionIcon } from "./pixel-action-icon";
import type { CompanionAction } from "./pixel-action-icon";
import { CompanionChatBubble } from "./companion-chat-bubble";

const actions: { id: CompanionAction | "chat"; label: string }[] = [
  { id: "hide", label: "Скрыть спутника" },
  { id: "chat", label: "Чат" },
  { id: "wardrobe", label: "Гардероб" },
  { id: "settings", label: "Настройки" },
];
const outline = "M16 0h24v4h8v4h4v8h4v24h-4v8h-4v4h-8v4H16v-4H8v-4H4v-8H0V16h4V8h4V4h8z";

export function CompanionOrbitMenu({ anchor, position, open, chatOpen, onChat, onAction }: {
  anchor: RefObject<HTMLDivElement | null>;
  position: CSSProperties;
  open: boolean;
  chatOpen: boolean;
  onChat: () => void;
  onAction: (action: CompanionAction) => void;
}) {
  const orbit = useOrbitPlacement(anchor, position.left, position.top);
  const { interactive, onTransitionEnd } = useRadialTransition(open);
  return (
    <div id="companion-actions" role="group" aria-label="Действия спутника" data-open={open} data-interactive={open && interactive}>
      {orbit && actions.map((action, index) => {
        const actionId = action.id;
        if (actionId === "chat") return <CompanionChatBubble key={actionId} placement={orbit.thought}
          dock={{ x: orbit.origin.x + orbit.offsets[index].x + orbit.size / 2,
            y: orbit.origin.y + orbit.offsets[index].y + orbit.size / 2, size: orbit.size }}
          menuOpen={open} open={chatOpen} onOpen={onChat} />;
        return <button key={actionId} type="button" aria-label={action.label} onClick={() => onAction(actionId)}
          aria-hidden={!open} inert={!open || !interactive}
          onTransitionEnd={index === actions.length - 1 ? onTransitionEnd : undefined}
          className={cx(`fixed z-38 flex items-center justify-center bg-transparent p-0 text-[#383c62]
            outline-none [will-change:transform,opacity] [transition:transform_240ms_cubic-bezier(.22,1,.36,1),opacity_160ms_ease-out]
            motion-reduce:transition-none group`,
            open ? "opacity-100" : "pointer-events-none opacity-0")}
          style={{ left: orbit.origin.x - 4, top: orbit.origin.y - 4, width: orbit.size + 8, height: orbit.size + 8,
            transform: open ? `translate3d(${orbit.offsets[index].x}px, ${orbit.offsets[index].y}px, 0) scale(1)` : "translate3d(0, 0, 0) scale(.45)",
            transitionDelay: open ? `${index * 16}ms` : "0ms",
          }}>
          <span className="relative grid aspect-square place-items-center" style={{ width: orbit.size, height: orbit.size }}>
            <svg className="absolute inset-0 size-full overflow-visible group-focus-visible:drop-shadow-[0_0_3px_#00aaff]"
              viewBox="0 0 56 56" shapeRendering="crispEdges" aria-hidden="true">
              <path d={outline} transform="translate(2 3)" fill="#383c6218" />
              <path d={outline} fill="#383c62" />
              <path d={outline} transform="translate(3 3) scale(.892857)" fill="#ffffff" />
            </svg>
            <span className="relative" style={{ transform: `scale(${orbit.scale})` }}><PixelActionIcon action={action.id} /></span>
          </span>
        </button>
      })}
    </div>
  );
}
