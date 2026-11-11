import { ArrowRight, Check } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import type { Pet } from "../model/types";
import { PixelPet } from "./pixel-pet";
interface PetCardProps {
  pet: Pet;
  number: number;
  selected: boolean;
  chosen: boolean;
  paused: boolean;
  onSelect: (pet: Pet) => void;
  actions?: ReactNode;
}
export function PetCard({
  pet,
  number,
  selected,
  chosen,
  paused,
  onSelect,
  actions,
}: PetCardProps) {
  return (
    <article
      className={`pet-card text-left bg-white rounded-[13px] overflow-hidden relative
            [transition:border-color_0.18s,_box-shadow_0.18s,_transform_0.18s] min-w-0
            [&:hover]:[transform:translateY(-3px)] [&:hover]:[box-shadow:0_5px_15px_#4839560b]
            motion-reduce:[&:hover]:[transform:none] [&.is-active]:[box-shadow:0_0_0_2px_#b2a0d310]
            [&.is-active_.card-arrow]:text-[#9e86c8] [&:hover_.card-arrow]:text-[#9e86c8]
            [&.has-actions_.card-info]:pr-[51px] [&.has-actions_.card-info]:min-h-[69px]
            [&.has-actions_.card-info_>_div]:min-w-0 [&.has-actions_.card-info_>_div_>_span]:block
            [&.has-actions_.card-info_>_div_>_span]:leading-[1.55] border [&.is-active]:border-[1.5px] border-solid
            [&.is-active]:border-solid border-[#e8e6ed] [&:hover]:border-[#b7a2d9] [&.is-active]:border-[#9f87cd]
            [&:focus-within]:border-[#9f87cd] p-[6px] [&.is-active]:p-[5.5px] ${selected ? "is-active" : ""}  ${actions ? "has-actions" : ""}`}
      style={
        {
          "--pet-bg": pet.bg,
          "--pet-color": pet.color,
        } as CSSProperties
      }
    >
      <button
        type="button"
        className={`pet-card-preview block w-full bg-transparent [text-align:inherit] rounded-[8px] p-0`}
        onClick={() => onSelect(pet)}
        aria-label={`Рассмотреть: ${pet.kind} ${pet.name}`}
        aria-pressed={selected}
      >
        <div className={`card-stage h-[167px] relative flex items-center justify-center bg-[var(--pet-bg)] rounded-[8px] overflow-hidden
            max-sm:h-[145px] sm:max-md:h-[147px] md:max-lg:h-[173px] xl:h-50 [&_.pixel-pet]:mt-2 max-sm:[&_.pixel-pet]:mt-1
            max-sm:[&_.pixel-pet]:w-32 max-sm:[&_.pixel-pet]:h-32 sm:max-md:[&_.pixel-pet]:w-28
            sm:max-md:[&_.pixel-pet]:h-28 xl:[&_.pixel-pet]:w-40 xl:[&_.pixel-pet]:h-40`}>
          <span className={`pet-number absolute top-3 left-3 text-[9px] text-[var(--pet-color)] opacity-55
            [font-variant-numeric:tabular-nums] max-sm:top-[10px] max-md:left-[9px] max-md:text-[8px]`}>{String(number).padStart(2, "0")}</span>
          {chosen ? (
            <span className={`adopted-label absolute right-2 top-[10px] flex items-center gap-[3px] text-[8px] text-[var(--pet-color)]
            bg-[#ffffffb0] rounded-[4px] z-4 py-[3px] px-[5px]`}>
              <Check size={11} />
              Твой бадди
            </span>
          ) : selected ? (
            <span className={`card-check absolute top-[10px] right-[10px] bg-[var(--pet-color)] text-white grid place-items-center w-[19px]
            h-[19px] rounded-full`}>
              <Check size={12} />
            </span>
          ) : null}
          <div className={`pixel-spark spark-one absolute w-1 h-1 bg-[var(--pet-color)] opacity-16 top-[38%] left-[18%]
            [box-shadow:4px_-4px_var(--pet-color)] max-sm:left-[12%]`} />
          <div className={`pixel-spark spark-two absolute w-[3px] h-[3px] bg-[var(--pet-color)] opacity-16 top-[61%] right-[17%]
            max-sm:right-[11%]`} />
          <span className={`ground-shadow absolute bottom-[18px] w-[70px] h-[7px] left-[50%] [transform:translateX(-50%)]
            bg-[var(--pet-color)] opacity-13
            [clip-path:polygon(_10%_0,_90%_0,_90%_25%,_100%_25%,_100%_75%,_90%_75%,_90%_100%,_10%_100%,_10%_75%,_0_75%,_0_25%,_10%_25%_)]
            max-sm:bottom-3`} />
          <PixelPet pet={pet} size={128} paused={paused} />
          <span className={`stage-ground absolute bottom-[14px] h-[1px] bg-[var(--pet-color)] opacity-8 w-[77%] max-sm:bottom-[11px]`} />
        </div>
        <div className={`card-info pt-[13px] pb-[10px] flex justify-between items-center max-md:pt-[11px] max-md:pb-2 xl:pt-[15px]
            xl:pb-3 [&_h2]:text-[13px] [&_h2]:font-[550] [&_h2]:mb-[5px] [&_h2]:tracking-[-0.1px]
            sm:max-md:[&_h2]:text-[12px] [&_>_div_>_span]:text-[11px] [&_>_div_>_span]:text-[#807886]
            max-sm:[&_>_div_>_span]:text-[10px] px-[10px] max-sm:px-2 sm:max-md:px-[6px] xl:px-[13px]`}>
          <div>
            <h2>{pet.name}</h2>
            <span>{pet.kind}</span>
          </div>
          {!actions && (
            <span className={`card-arrow text-[#c1bacb] max-sm:block sm:max-md:hidden`}>
              <ArrowRight size={17} />
            </span>
          )}
        </div>
      </button>
      {actions && <div className="pet-card-actions absolute right-[8px] bottom-[12px]">{actions}</div>}
    </article>
  );
}
