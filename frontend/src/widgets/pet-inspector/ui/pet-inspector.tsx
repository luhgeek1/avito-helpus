import { useState } from "react";
import type { CSSProperties } from "react";
import { Maximize2, Sparkles } from "lucide-react";
import { PixelPet, usePetPreferences } from "@/entities/pet";
import type { Pet } from "@/entities/pet";
import { FavoritePetButton } from "@/features/pet/favorite";
import { ChoosePetButton } from "@/features/pet/choose";
import { DownloadPetButton } from "@/features/pet/download";
import { GreetPetButton, usePetGreeting } from "@/features/pet/greet";
export function PetInspector({ pet: active }: { pet: Pet }) {
  const [scale, setScale] = useState(2);
  const { paused } = usePetPreferences();
  const { speaking, greet } = usePetGreeting();
  return (
    <aside className={`pet-detail bg-white rounded-[13px] overflow-hidden sticky top-6 [box-shadow:0_4px_12px_#2b213903]
            max-sm:relative max-sm:top-[auto] max-sm:w-full max-xs:flex max-sm:grid-cols-2 max-sm:[scroll-margin-top:78px]
            max-xs:flex-col xs:max-sm:grid border border-solid border-[#e6e3ec]`} aria-label="Знакомство с выбранным петом">
      <div className={`detail-heading flex items-center justify-between pt-[18px] pb-4 max-sm:[grid-column:1/-1] max-xs:w-full
            [&_>_span:first-child]:text-[8px] [&_>_span:first-child]:tracking-[1.1px] [&_>_span:first-child]:text-[#807488]
            max-sm:p-[17px] px-[18px]`}>
        <span>ПОЗНАКОМИМСЯ?</span>
        <button
          className={`detail-mobile-back hidden max-sm:block max-sm:bg-transparent max-sm:text-[#9480ab] max-sm:text-[9px]
            max-sm:min-h-11 max-sm:p-[6px]`}
          onClick={() =>
            document
              .querySelector(".collection-toolbar")
              ?.scrollIntoView({ block: "start" })
          }
        >
          К коллекции ↑
        </button>
        <span className={`detail-online text-[9px] flex items-center gap-[5px] text-[#7d8b7a] [&_i]:w-[5px] [&_i]:h-[5px]
            [&_i]:bg-[#9bbc89] [&_i]:rounded-full`}>
          <i />
          Рядом
        </span>
      </div>
      <div
        className={`detail-stage h-61 relative bg-[var(--pet-bg)] rounded-[8px] overflow-hidden flex flex-col justify-center
            items-center max-sm:[grid-column:1] max-sm:[grid-row:2] max-sm:[align-self:stretch]
            max-xs:w-[calc(100%_-_20px)] xs:max-sm:h-[230px] xs:max-sm:mr-0 xl:h-[270px] [&::before]:[content:'']
            [&::before]:absolute [&::before]:top-0 [&::before]:right-0 [&::before]:bottom-0 [&::before]:left-0
            [&::before]:[background-image:radial-gradient(var(--pet-color)_0.6px,_transparent_0.6px)]
            [&::before]:[background-size:12px_12px] [&::before]:opacity-10 max-sm:[&_.speech-bubble]:left-[7px]
            max-sm:[&_.speech-bubble]:right-[7px] max-sm:[&_.speech-bubble]:top-[10px] max-sm:[&_.speech-bubble]:text-[9px]
            max-sm:[&_.speech-bubble]:p-[7px] my-0 mx-[10px]`}
        style={
          {
            "--pet-bg": active.bg,
            "--pet-color": active.color,
          } as CSSProperties
        }
      >
        <span className={`detail-orbit orbit-one w-[5px] h-[5px] bg-[var(--pet-color)] opacity-25 absolute top-[45px] right-[43px]
            [box-shadow:-5px_5px_var(--pet-color),_5px_5px_var(--pet-color),_0_10px_var(--pet-color)]`} />
        <span className={`detail-orbit orbit-two w-[3px] h-[3px] bg-[var(--pet-color)] opacity-25 absolute left-[39px] bottom-14
            [box-shadow:3px_-3px_var(--pet-color)]`} />
        {speaking && (
          <div className={`speech-bubble absolute z-5 left-[13px] right-[13px] top-[13px] bg-white rounded-[7px] text-[10px] leading-[1.6]
            text-[#756482] [box-shadow:0_3px_0_#00000003] [&::after]:[content:''] [&::after]:absolute [&::after]:w-[7px]
            [&::after]:h-[7px] [&::after]:left-[50%] [&::after]:bottom-[-5px] [&::after]:[border-bottom-width:1px]
            [&::after]:[border-bottom-style:solid] [&::after]:[border-bottom-color:#e3dbe9]
            [&::after]:[border-right-width:1px] [&::after]:[border-right-style:solid]
            [&::after]:[border-right-color:#e3dbe9] [&::after]:[transform:rotate(45deg)] [&::after]:bg-white border
            border-solid border-[#e3dbe9] py-[10px] px-[11px]`} role="status">
            {active.greeting}
          </div>
        )}
        <div className={`detail-pet-space relative w-full h-50 flex items-end justify-center pb-[14px] [&_.ground-shadow]:bottom-[17px]
            [&_.ground-shadow]:w-[83px] max-xs:[&_.pixel-pet]:max-w-48 max-xs:[&_.pixel-pet]:max-h-48
            xs:max-sm:[&_.pixel-pet]:max-w-40 xs:max-sm:[&_.pixel-pet]:max-h-40`}>
          <span className={`ground-shadow absolute bottom-[18px] w-[70px] h-[7px] left-[50%] [transform:translateX(-50%)]
            bg-[var(--pet-color)] opacity-13
            [clip-path:polygon(_10%_0,_90%_0,_90%_25%,_100%_25%,_100%_75%,_90%_75%,_90%_100%,_10%_100%,_10%_75%,_0_75%,_0_25%,_10%_25%_)]
            max-sm:bottom-3`} />
          <PixelPet
            key={active.id}
            pet={active}
            size={scale === 1 ? 128 : scale === 2 ? 160 : 192}
            paused={paused}
          />
        </div>
        <span className={`detail-stage-label text-[8px] text-[var(--pet-color)] opacity-100 absolute bottom-3 tracking-[0.3px]
            [filter:brightness(0.8)] max-sm:bottom-[14px] xs:max-sm:text-[7px]`}>
          {paused
            ? "тихий режим"
            : active.category === "orbi" || active.id === "orbit"
              ? "на орбите и рядом"
              : "чувствует себя как дома"}
        </span>
      </div>
      <div className={`scale-toolbar flex justify-between items-center [border-bottom-width:1px] [border-bottom-style:solid]
            [border-bottom-color:#f1eef4] max-sm:[grid-column:1] max-sm:[grid-row:3] max-sm:[border-top-style:solid]
            max-sm:[border-right-style:solid] max-sm:[border-left-style:solid] max-sm:gap-1 [&_>_span]:text-[9px]
            [&_>_span]:text-[#8a7c94] [&_>_span]:flex [&_>_span]:gap-[6px] [&_>_span]:items-center
            xs:max-sm:[&_>_span]:text-[0px] xs:max-sm:[&_>_span]:gap-0 [&_>_div]:flex [&_>_div]:gap-[3px]
            [&_button]:text-[9px] [&_button]:w-[27px] [&_button]:h-[23px] [&_button]:bg-transparent
            [&_button]:text-[#a9a2b1] [&_button]:rounded-[4px] max-sm:[&_button]:w-10 max-sm:[&_button]:h-11
            max-sm:[&_button]:min-w-[26px] [&_button.selected]:bg-[#f1edf7] [&_button.selected]:text-[#807090]
            [&_button.selected]:font-[550] max-sm:border-0 max-sm:border-[currentColor] py-[13px] max-xs:py-2
            xs:max-sm:py-[5px] px-[19px] max-sm:px-0 max-sm:my-0 max-xs:mx-[17px] xs:max-sm:mx-2`}>
        <span>
          <Maximize2 size={13} />
          Масштаб
        </span>
        <div aria-label="Масштаб персонажа">
          {[1, 2, 3].map((s) => (
            <button
              key={s}
              onClick={() => setScale(s)}
              className={`${s === scale ? " selected" : ""}`}
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
