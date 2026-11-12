import { useState } from "react";
import type { CSSProperties } from "react";
import { Maximize2, Sparkles } from "lucide-react";
import { GroundShadow, PixelPet, usePetPreferences } from "@/entities/pet";
import type { Pet } from "@/entities/pet";
import { FavoritePetButton } from "@/features/pet/favorite";
import { ChoosePetButton } from "@/features/pet/choose";
import { DownloadPetButton } from "@/features/pet/download";
import { GreetPetButton, usePetGreeting } from "@/features/pet/greet";
import { cx } from "@/shared/lib/cx";
export function PetInspector({ pet: active }: { pet: Pet }) {
  const [scale, setScale] = useState(2);
  const { paused } = usePetPreferences();
  const { speaking, greet } = usePetGreeting();
  return (
    <aside
      className="pet-detail sticky top-6 overflow-hidden rounded-[13px] border border-[#e6e3ec] bg-white
            shadow-[0_4px_12px_#2b213903] max-sm:relative max-sm:top-auto max-sm:w-full max-sm:scroll-mt-19.5
            max-sm:grid-cols-2 max-xs:flex max-xs:flex-col xs:max-sm:grid"
      aria-label="Знакомство с выбранным петом"
    >
      <div className="flex items-center justify-between px-4.5 pt-4.5 pb-4 max-sm:col-span-full max-sm:p-4.25 max-xs:w-full">
        <span className="text-8 tracking-[1.1px] text-[#807488]">ПОЗНАКОМИМСЯ?</span>
        <button
          className="hidden max-sm:block max-sm:min-h-11 max-sm:bg-transparent max-sm:p-1.5 max-sm:text-9 max-sm:text-[#9480ab]"
          onClick={() =>
            document
              .querySelector(".collection-toolbar")
              ?.scrollIntoView({ block: "start" })
          }
        >
          К коллекции ↑
        </button>
        <span className="flex items-center gap-1.25 text-9 text-[#7d8b7a]">
          <i className="size-1.25 rounded-full bg-[#9bbc89]" />
          Рядом
        </span>
      </div>
      <div
        className="relative mx-2.5 my-0 flex h-61 flex-col items-center justify-center overflow-hidden rounded-lg bg-pet-bg
            before:absolute before:inset-0 before:bg-[radial-gradient(var(--pet-color)_0.6px,transparent_0.6px)]
            before:bg-size-[12px_12px] before:opacity-10 before:content-[''] max-sm:col-start-1 max-sm:row-start-2
            max-sm:self-stretch max-xs:w-[calc(100%-20px)] xs:max-sm:mr-0 xs:max-sm:h-57.5 xl:h-67.5"
        style={
          {
            "--pet-bg": active.bg,
            "--pet-color": active.color,
          } as CSSProperties
        }
      >
        <span className="absolute top-11.25 right-10.75 size-1.25 bg-pet opacity-25
            shadow-[-5px_5px_var(--pet-color),5px_5px_var(--pet-color),0_10px_var(--pet-color)]" />
        <span className="absolute bottom-14 left-9.75 size-0.75 bg-pet opacity-25 shadow-[3px_-3px_var(--pet-color)]" />
        {speaking && (
          <div
            className="absolute inset-x-3.25 top-3.25 z-5 rounded-[7px] border border-[#e3dbe9] bg-white px-2.75 py-2.5
            text-10 leading-[1.6] text-[#756482] shadow-[0_3px_0_#00000003] after:absolute after:-bottom-1.25 after:left-1/2
            after:size-1.75 after:rotate-45 after:border-r after:border-b after:border-[#e3dbe9] after:bg-white
            after:content-[''] max-sm:inset-x-1.75 max-sm:top-2.5 max-sm:p-1.75 max-sm:text-9"
            role="status"
          >
            {active.greeting}
          </div>
        )}
        <div className="relative flex h-50 w-full items-end justify-center pb-3.5">
          <GroundShadow className="bottom-4.25 w-20.75" />
          <PixelPet
            key={active.id}
            pet={active}
            size={scale === 1 ? 128 : scale === 2 ? 160 : 192}
            paused={paused}
            className="max-xs:max-h-48 max-xs:max-w-48 xs:max-sm:max-h-40 xs:max-sm:max-w-40"
          />
        </div>
        <span className="absolute bottom-3 text-8 tracking-[0.3px] text-pet opacity-100 brightness-80 max-sm:bottom-3.5
            xs:max-sm:text-7">
          {paused
            ? "тихий режим"
            : active.category === "orbi" || active.id === "orbit"
              ? "на орбите и рядом"
              : "чувствует себя как дома"}
        </span>
      </div>
      <div className="flex items-center justify-between border-b border-[#f1eef4] px-4.75 py-3.25 max-sm:col-start-1
            max-sm:row-start-3 max-sm:my-0 max-sm:gap-1 max-sm:border-0 max-sm:px-0 max-xs:mx-4.25 max-xs:py-2
            xs:max-sm:mx-2 xs:max-sm:py-1.25">
        <span className="flex items-center gap-1.5 text-9 text-[#8a7c94] xs:max-sm:gap-0 xs:max-sm:text-[0px]">
          <Maximize2 size={13} />
          Масштаб
        </span>
        <div className="flex gap-0.75" aria-label="Масштаб персонажа">
          {[1, 2, 3].map((s) => (
            <button
              key={s}
              onClick={() => setScale(s)}
              className={cx(
                "h-5.75 w-6.75 rounded-sm bg-transparent text-9 text-[#a9a2b1] max-sm:h-11 max-sm:w-10 max-sm:min-w-6.5",
                s === scale && "bg-[#f1edf7] font-[550] text-[#807090]",
              )}
              aria-label={`Масштаб ${s}×`}
              aria-pressed={s === scale}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>
      <div className={`detail-copy pt-[21px] pb-[14px] max-sm:[grid-column:2] max-sm:[grid-row:2/4] max-sm:[align-self:start]
            max-xs:w-full xs:max-sm:pr-[13px] xs:max-sm:pl-[15px] [&_>_p]:text-[12px] [&_>_p]:leading-[1.9]
            [&_>_p]:text-[#756b7e] [&_>_p]:mt-3 [&_>_p]:min-h-[63px] max-sm:[&_>_p]:leading-[1.7] max-sm:[&_>_p]:mt-[10px]
            max-sm:[&_>_p]:min-h-0 xs:max-sm:[&_>_p]:text-[10px] xl:p-6 max-xs:py-[15px] xs:max-sm:py-0 px-[19px]
            max-xs:px-[18px]`}>
        <div className={`detail-name flex items-baseline gap-[9px] xs:max-sm:block [&_h2]:text-[25px] [&_h2]:font-semibold
            [&_h2]:tracking-[-0.7px] max-sm:[&_h2]:text-[24px] [&_>_span]:text-[11px] [&_>_span]:text-[#8b7e96]
            max-sm:[&_>_span]:text-[10px] max-sm:[&_>_span]:block max-sm:[&_>_span]:mt-1`}>
          <h2>{active.name}</h2>
          <span>{active.kind}</span>
        </div>
        <p>{active.description}</p>
        <span className={`personality inline-block text-[9px] text-[#796784] bg-[#f7f4f9] rounded-[5px] mt-[15px] max-sm:mt-[9px]
            max-sm:whitespace-nowrap xs:max-sm:text-[7px] max-sm:p-[6px] py-[7px] px-[9px]`}>{active.personality}</span>
        <div className={`palette-row flex items-center justify-between [&_>_span]:text-[10px] [&_>_span]:text-[#83718e]
            xs:max-sm:[&_>_span]:text-[8px] [&_>_div]:flex [&_>_div]:gap-[5px] max-sm:[&_>_div]:gap-1
            [&_>_div_>_span]:h-[15px] [&_>_div_>_span]:w-[15px] [&_>_div_>_span]:rounded-full
            xs:max-sm:[&_>_div_>_span]:h-3 xs:max-sm:[&_>_div_>_span]:w-3 [&_>_div_>_span]:border
            [&_>_div_>_span]:border-solid [&_>_div_>_span]:border-[#00000008] my-[22px] max-sm:my-3 mx-0`}>
          <span>Его цвета</span>
          <div>
            {active.palette.map((c) => (
              <span key={c} style={{ background: c }} title={c} />
            ))}
          </div>
        </div>
        <ChoosePetButton pet={active} />
        <FavoritePetButton pet={active} showLabel />
        <div className={`detail-actions flex mt-[9px] gap-2 max-sm:mt-[6px] max-sm:gap-[5px] [&_button]:flex [&_button]:justify-center
            [&_button]:items-center [&_button]:gap-[7px] [&_button]:min-h-[37px] [&_button]:rounded-[6px]
            [&_button]:bg-white [&_button]:text-[#7f6b8f] [&_button]:text-[10px] max-sm:[&_button]:gap-1
            max-sm:[&_button]:min-h-11 max-sm:[&_button]:text-[8px] [&_button:hover]:bg-[#f9f6fc]
            [&_button:first-child]:[flex:1] max-xs:[&_button:first-child]:text-[10px]
            xs:max-sm:[&_button:first-child]:text-[8px] [&_button:last-child]:w-[37px]
            max-sm:[&_button:last-child]:w-[35px] max-sm:[&_button_svg]:w-[13px] [&_button]:border [&_button]:border-solid
            [&_button]:border-[#ebe7f0]`}>
          <GreetPetButton onGreet={greet} />
          <DownloadPetButton pet={active} />
        </div>
      </div>
      <div className={`detail-footnote flex justify-center items-center gap-[6px] text-[8px] text-[#8a7898] bg-[#fbfafc]
            [border-top-width:1px] [border-top-style:solid] [border-top-color:#f1edf5] max-sm:[grid-column:1/-1]
            max-xs:w-full xs:max-sm:mt-3 py-[13px] px-2 max-xs:m-0`}>
        <Sparkles size={14} />
        <span>Маленький пет, большая поддержка.</span>
      </div>
    </aside>
  );
}
