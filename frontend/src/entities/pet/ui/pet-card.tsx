import { ArrowRight, Check } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import type { Pet } from "../model/types";
import { cx } from "@/shared/lib/cx";
import { GroundShadow } from "./ground-shadow";
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
  const hasActions = Boolean(actions);
  return (
    <article
      className={cx(
        "group relative min-w-0 overflow-hidden rounded-[13px] border border-[#e8e6ed] bg-white p-1.5 text-left",
        "transition-[border-color,box-shadow,translate] duration-180 hover:-translate-y-0.75 hover:border-[#b7a2d9]",
        "hover:shadow-[0_5px_15px_#4839560b] focus-within:border-[#9f87cd] motion-reduce:hover:translate-none",
        selected && "border-[1.5px] border-[#9f87cd] p-[5.5px] shadow-[0_0_0_2px_#b2a0d310]",
      )}
      style={
        {
          "--pet-bg": pet.bg,
          "--pet-color": pet.color,
        } as CSSProperties
      }
    >
      <button
        type="button"
        className="block w-full rounded-lg bg-transparent p-0 [text-align:inherit]"
        onClick={() => onSelect(pet)}
        aria-label={`Рассмотреть: ${pet.kind} ${pet.name}`}
        aria-pressed={selected}
      >
        <div className="relative flex h-41.75 items-center justify-center overflow-hidden rounded-lg bg-pet-bg max-sm:h-36.25
            sm:max-md:h-36.75 md:max-lg:h-43.25 xl:h-50">
          <span className="absolute top-3 left-3 text-9 text-pet tabular-nums opacity-55 max-md:left-2.25 max-md:text-8
            max-sm:top-2.5">{String(number).padStart(2, "0")}</span>
          {chosen ? (
            <span className="absolute top-2.5 right-2 z-4 flex items-center gap-0.75 rounded-sm bg-[#ffffffb0] px-1.25 py-0.75
            text-8 text-pet">
              <Check size={11} />
              Твой бадди
            </span>
          ) : selected ? (
            <span className="absolute top-2.5 right-2.5 grid size-4.75 place-items-center rounded-full bg-pet text-white">
              <Check size={12} />
            </span>
          ) : null}
          <div className="absolute top-[38%] left-[18%] size-1 bg-pet opacity-16 shadow-[4px_-4px_var(--pet-color)]
            max-sm:left-[12%]" />
          <div className="absolute top-[61%] right-[17%] size-0.75 bg-pet opacity-16 max-sm:right-[11%]" />
          <GroundShadow className="bottom-4.5 max-sm:bottom-3" />
          <PixelPet
            pet={pet}
            size={128}
            paused={paused}
            className="mt-2 max-sm:mt-1 max-sm:size-32 sm:max-md:size-28 xl:size-40"
          />
          <span className="absolute bottom-3.5 h-px w-[77%] bg-pet opacity-8 max-sm:bottom-2.75" />
        </div>
        <div className={cx(
          "flex items-center justify-between px-2.5 pt-3.25 pb-2.5 max-md:pt-2.75 max-md:pb-2 max-sm:px-2 sm:max-md:px-1.5",
          "xl:px-3.25 xl:pt-3.75 xl:pb-3",
          // Room for the favourite button at every breakpoint.
          hasActions && "min-h-17.25 pr-12.75 max-sm:pr-12.75 sm:max-md:pr-12.75 xl:pr-12.75",
        )}>
          <div className={cx(hasActions && "min-w-0")}>
            <h2 className="mb-1.25 text-13 font-[550] tracking-[-0.1px] sm:max-md:text-12">{pet.name}</h2>
            <span className={cx("text-11 text-[#807886] max-sm:text-10", hasActions && "block leading-[1.55]")}>{pet.kind}</span>
          </div>
          {!actions && (
            <span className={cx(
              "text-[#c1bacb] group-hover:text-[#9e86c8] max-sm:block sm:max-md:hidden",
              selected && "text-[#9e86c8]",
            )}>
              <ArrowRight size={17} />
            </span>
          )}
        </div>
      </button>
      {actions && <div className="absolute right-2 bottom-3">{actions}</div>}
    </article>
  );
}
