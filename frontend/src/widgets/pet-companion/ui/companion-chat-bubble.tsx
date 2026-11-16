import { cx } from "@/shared/lib/cx";
import { PixelActionIcon } from "./pixel-action-icon";

const outline = "M16 0h24v4h8v4h4v8h4v24h-4v8h-4v4h-8v4H16v-4H8v-4H4v-8H0V16h4V8h4V4h8z";

export function CompanionChatBubble({ placement, dock, visible = true, menuOpen, open, onOpen }: {
  placement: { left: number; top: number; size: number; flipX: boolean; flipY: boolean };
  dock: { x: number; y: number; size: number };
  visible?: boolean;
  menuOpen: boolean;
  open: boolean;
  onOpen: () => void;
}) {
  const { left, top, size, flipX, flipY } = placement;
  const centerX = (flipX ? 44 : 28) / 72 * size;
  const centerY = (flipY ? 44 : 28) / 72 * size;
  const transform = menuOpen
    ? `translate3d(${dock.x - left - centerX}px, ${dock.y - top - centerY}px, 0) scale(${dock.size / (size * 56 / 72)})`
    : "translate3d(0, 0, 0) scale(1)";
  return <button type="button" aria-label="Чат" title={open ? "Закрыть чат" : "Открыть чат"} aria-expanded={open}
    aria-controls="companion-chat" onClick={onOpen} data-docked={menuOpen} aria-hidden={!visible} inert={!visible}
    style={{ left, top, width: size, height: size, transform, transformOrigin: `${centerX}px ${centerY}px` }}
    className={cx("companion-chat-bubble fixed z-38 cursor-pointer bg-transparent p-0 outline-none group",
      "[transition:transform_280ms_cubic-bezier(.22,1,.36,1),opacity_160ms_ease-out] motion-reduce:transition-none",
      visible ? "visible opacity-100" : "invisible pointer-events-none opacity-0",
      open && "z-42 max-sm:z-39 [@media(max-height:430px)]:z-39")}>
    <svg viewBox="0 0 72 72" shapeRendering="crispEdges" aria-hidden="true"
      className={cx("size-full overflow-visible animate-thought-bubble motion-reduce:animate-none group-focus-visible:drop-shadow-[0_0_3px_#00aaff]",
        flipY ? (flipX ? "origin-top-left" : "origin-top-right") : (flipX ? "origin-bottom-left" : "origin-bottom-right"))}>
      <g transform={`translate(${flipX ? 72 : 0} ${flipY ? 72 : 0}) scale(${flipX ? -1 : 1} ${flipY ? -1 : 1})`}>
        <path d={outline} transform="translate(2 3)" fill="#383c6218" />
        <path d={outline} fill="#383c62" />
        <path d={outline} transform="translate(3 3) scale(.892857)" fill="#ffffff"
          className="transition-colors duration-150 group-hover:fill-[#eef8ff] group-active:fill-[#dff3ff] motion-reduce:transition-none" />
        <g className={cx("transition-opacity duration-150 motion-reduce:transition-none", menuOpen ? "opacity-0" : "delay-100 opacity-100")}>
          <path d="M54 56h8v8h-8z M66 66h4v4h-4z" fill="#383c62" />
          <path d="M56 58h4v4h-4z" fill="#ffffff" />
        </g>
      </g>
      <g transform={`translate(${flipX ? 32 : 16} ${flipY ? 32 : 16})`}><PixelActionIcon action="chat" /></g>
    </svg>
  </button>;
}
