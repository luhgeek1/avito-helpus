import { memo } from "react";
import { PixelPet } from "@/entities/pet";
import type { Pet } from "@/entities/pet";
import type { WardrobePlacement } from "../model/use-wardrobe-placement";

const Preview = memo(PixelPet);
const outline = "M16 0h24v4h8v4h4v8h4v24h-4v8h-4v4h-8v4H16v-4H8v-4H4v-8H0V16h4V8h4V4h8z";

export function WardrobePetOption({ pet, layout, offset, revealed, interactive, chosen, paused, onChoose }: {
  pet: Pet; layout: WardrobePlacement; offset: number; revealed: boolean;
  interactive: boolean; chosen: boolean; paused: boolean;
  onChoose: (keyboard: boolean) => void;
}) {
  const visible = Math.abs(offset) <= 2;
  const angle = (layout.horizontal < 0 ? 180 : 0) + layout.horizontal * layout.vertical * (50 + offset * 25);
  const scale = offset === 0 ? 1.04 : .9;
  return (
    <button type="button" aria-label={`Выбрать персонажа ${pet.name}`} aria-pressed={chosen}
      data-pet-id={pet.id} data-center={offset === 0} aria-hidden={!visible}
      disabled={!visible || !interactive} tabIndex={visible ? 0 : -1}
      onClick={(event) => onChoose(event.detail === 0)}
      className={`wardrobe-pet pointer-events-auto fixed grid touch-none select-none place-items-center bg-transparent p-0
        [transition:transform_280ms_cubic-bezier(.22,1,.36,1),opacity_200ms_ease] will-change-transform
        motion-reduce:transition-none focus-visible:[&_svg.wardrobe-disc]:drop-shadow-[0_0_4px_#00aaff]
        ${revealed && visible ? "opacity-100" : "pointer-events-none opacity-0"}`}
      style={{ left: layout.cx - (layout.size + 8) / 2, top: layout.cy - (layout.size + 8) / 2,
        width: layout.size + 8, height: layout.size + 8,
        transform: `rotate(${angle}deg) translateX(${revealed ? layout.radius : 0}px) rotate(${-angle}deg) scale(${revealed ? scale : .25})`,
      }}>
      <span className="relative grid place-items-center" style={{ width: layout.size, height: layout.size }}>
        <svg className="wardrobe-disc absolute inset-0 size-full overflow-visible [filter:drop-shadow(2px_3px_0_#383c6218)]"
          viewBox="0 0 56 56" shapeRendering="crispEdges" aria-hidden="true">
          <path d={outline} fill={chosen ? "#00aaff" : "#383c62"} />
          <path d={outline} transform="translate(2 2) scale(.928571)" fill="#ffffff" />
        </svg>
        <Preview pet={pet} size={layout.size - 4} paused={paused} />
      </span>
    </button>
  );
}
