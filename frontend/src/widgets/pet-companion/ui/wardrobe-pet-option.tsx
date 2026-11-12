import { memo } from "react";
import type { TransitionEventHandler } from "react";
import { PixelPet } from "@/entities/pet";
import type { Pet } from "@/entities/pet";
import type { WardrobePlacement } from "../model/use-wardrobe-placement";

const Preview = memo(PixelPet);
const outline = "M16 0h24v4h8v4h4v8h4v24h-4v8h-4v4h-8v4H16v-4H8v-4H4v-8H0V16h4V8h4V4h8z";

export function WardrobePetOption({ pet, layout, offset, slot, revealed, interactive, chosen, paused, onChoose, onTransitionEnd }: {
  pet: Pet; layout: WardrobePlacement; offset: number; slot: number; revealed: boolean;
  interactive: boolean; chosen: boolean; paused: boolean;
  onChoose: (keyboard: boolean) => void;
  onTransitionEnd?: TransitionEventHandler<HTMLSpanElement>;
}) {
  const visible = Math.abs(slot) <= (layout.semicircle ? 3 : 2);
  const angle = layout.semicircle ? offset * 30 : (layout.horizontal < 0 ? 180 : 0) + layout.horizontal * layout.vertical * (48 + offset * 24);
  const scale = .9 + .14 * Math.max(0, 1 - Math.abs(offset));
  const radians = angle * Math.PI / 180;
  const dx = Math.cos(radians) * layout.radius, dy = Math.sin(radians) * layout.radius;
  return (
    <button type="button" aria-label={`Выбрать персонажа ${pet.name}`} aria-pressed={chosen}
      data-pet-id={pet.id} data-center={slot === 0} aria-hidden={!visible}
      disabled={!visible || !interactive} tabIndex={visible ? 0 : -1}
      onClick={(event) => onChoose(event.detail === 0)}
      // Touch handling stays as before: the global button rule outranked touch-none here.
      className={`pointer-events-auto fixed grid touch-manipulation select-none place-items-center bg-transparent p-0
        [will-change:transform,opacity] [transition:opacity_160ms_ease-out]
        motion-reduce:transition-none group
        ${revealed && visible ? "opacity-100" : "pointer-events-none opacity-0"}`}
      style={{ left: layout.cx - (layout.size + 8) / 2, top: layout.cy - (layout.size + 8) / 2,
        width: layout.size + 8, height: layout.size + 8,
        transform: `translate3d(${dx}px, ${dy}px, 0) scale(${scale})`,
      }}>
      <span onTransitionEnd={onTransitionEnd}
        className="relative grid place-items-center will-change-transform [transition:transform_240ms_cubic-bezier(.22,1,.36,1)] motion-reduce:transition-none"
        style={{ width: layout.size, height: layout.size,
          transform: revealed ? "translate3d(0, 0, 0) scale(1)" : `translate3d(${-dx / scale}px, ${-dy / scale}px, 0) scale(.45)` }}>
        <svg className="absolute inset-0 size-full overflow-visible group-focus-visible:drop-shadow-[0_0_4px_#00aaff]"
          viewBox="0 0 56 56" shapeRendering="crispEdges" aria-hidden="true">
          <path d={outline} transform="translate(2 3)" fill="#383c6218" />
          <path d={outline} fill={chosen ? "#00aaff" : "#383c62"} />
          <path d={outline} transform="translate(2 2) scale(.928571)" fill="#ffffff" />
        </svg>
        {/* Hidden or animating options stay on their first frame. */}
        <Preview pet={pet} size={layout.size - 4} paused={paused || !interactive} />
      </span>
    </button>
  );
}
