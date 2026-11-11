import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { CompanionWardrobe } from "./companion-wardrobe";
import { CompanionOrbitMenu } from "./companion-orbit-menu";
import { CompanionSettings } from "./companion-settings";
import { useCompanionActions } from "../model/use-companion-actions";
import { Volume2, X } from "lucide-react";
import { PixelPet, usePetPreferences } from "@/entities/pet";
import { useTypewriter } from "../model/use-typewriter";
import { useDialoguePlacement } from "../model/use-dialogue-placement";
import { useCompanionPosition } from "../model/use-companion-position";
export function PetCompanion() {
  const { chosenPet, paused, selectionVersion } = usePetPreferences();
  const [widgetVisible, setWidgetVisible] = useState(true);
  const [widgetSpeaking, setWidgetSpeaking] = useState(false);
  const movement = useCompanionPosition(Boolean(chosenPet) && widgetVisible);
  const actions = useCompanionActions(movement.ref, setWidgetSpeaking, movement.dragging, widgetVisible);
  useEffect(() => {
    if (selectionVersion > 0) {
      setWidgetVisible(true);
      setWidgetSpeaking(false);
      actions.dismiss();
    }
  }, [selectionVersion, actions.dismiss]);
  const dialogue = useTypewriter(chosenPet?.greeting ?? "", widgetSpeaking && widgetVisible, paused);
  const placement = useDialoguePlacement(movement.ref, widgetSpeaking && widgetVisible,
    movement.style.left, movement.style.top);
  return (
    <>
      {chosenPet && widgetVisible && (
        <div
          ref={movement.ref}
          className={`companion [&.is-talking_.widget-pet_.pixel-pet]:animate-companion-talk fixed bottom-5 right-[25px] z-35 w-40
            animate-appear max-sm:bottom-3 max-sm:right-[10px] max-sm:w-36 [&.is-dragging_.widget-pet]:cursor-grabbing${movement.dragging ? " is-dragging" : ""}${dialogue.typing && !paused ? " is-talking" : ""}`}
          style={
            {
              ...movement.style,
              "--pet-bg": chosenPet.bg,
              "--pet-color": chosenPet.color,
            } as CSSProperties
          }
        >
          {actions.settingsOpen && <CompanionSettings anchor={movement.ref} position={movement.style}
            onClose={actions.dismiss} onHide={() => { actions.dismiss(); setWidgetVisible(false); }} />}
          {widgetSpeaking && (
            <div ref={placement.ref} className={`widget-bubble pixel-dialogue fixed z-36 w-81 max-w-[calc(100vw_-_16px)] pt-3 pb-2 text-[#faf7ff] bg-[#303552]
            rounded-[0] [box-shadow:0_0_0_3px_#373b60,_6px_6px_0_3px_#373b6026] font-pixel text-[10px] font-normal
            leading-[1.6] [-webkit-font-smoothing:none] animate-dialogue-open max-sm:pt-[10px] max-sm:pb-[6px]
            max-sm:text-[9px] [&[data-side=left]::after]:[content:''] [&[data-side=left]::after]:absolute
            [&[data-side=left]::after]:top-[calc(50%_-_8px)] [&[data-side=left]::after]:w-2 [&[data-side=left]::after]:h-4
            [&[data-side=left]::after]:bg-[#e9e5ff] [&[data-side=left]::after]:[box-shadow:4px_4px_#373b60]
            [&[data-side=left]::after]:right-[-12px] [&[data-side=right]::after]:[content:'']
            [&[data-side=right]::after]:absolute [&[data-side=right]::after]:top-[calc(50%_-_8px)]
            [&[data-side=right]::after]:w-2 [&[data-side=right]::after]:h-4 [&[data-side=right]::after]:bg-[#e9e5ff]
            [&[data-side=right]::after]:[box-shadow:4px_4px_#373b60] [&[data-side=right]::after]:left-[-12px]
            [&_>_button]:absolute [&_>_button]:top-1 [&_>_button]:right-1 [&_>_button]:grid [&_>_button]:place-items-center
            [&_>_button]:w-8 [&_>_button]:h-8 [&_>_button]:bg-transparent [&_>_button]:text-[#c7bbdf]
            [&_>_button:hover]:text-white border-[4px] border-solid border-[#e9e5ff] [&_>_button]:p-0 px-3 max-sm:px-[10px]`}
              style={placement.style} data-side={placement.side}>
              <strong className={`dialogue-name block mb-[6px] pr-6 text-[#9de1f3] [font-family:inherit] text-[11px] font-[inherit]
            [font-style:inherit] leading-[inherit] max-sm:text-[10px]`}>{chosenPet.name}</strong>
              <div className="dialogue-copy flex gap-2 max-sm:gap-[6px]" aria-hidden="true">
                <span className="dialogue-star text-[#d7b5ff]">*</span>
                <span className="dialogue-lines grid min-w-[0] [overflow-wrap:anywhere]">
                  <span className="dialogue-reserve [grid-area:1_/_1] invisible">{chosenPet.greeting}</span>
                  <span className="dialogue-typed [grid-area:1_/_1] whitespace-pre-wrap">{dialogue.displayed}</span>
                </span>
              </div>
              <span className={`dialogue-accessible absolute w-[1px] h-[1px] overflow-hidden [clip-path:inset(50%)] whitespace-nowrap`} role="status">{chosenPet.greeting}</span>
              <div className="dialogue-footer flex items-center justify-end h-4 mt-1 leading-none">
                {dialogue.typing ? (
                  <button className={`dialogue-skip pr-0 pl-2 bg-transparent text-[#c7bbdf] [font-family:inherit] text-[8px] font-[inherit]
            [font-style:inherit] leading-[inherit] max-sm:text-[7px] [&:hover]:text-white py-0`} onClick={dialogue.complete}>Показать сразу</button>
                ) : <span className="dialogue-ready text-[#ee95bf] animate-dialogue-cursor" aria-hidden="true">◆</span>}
              </div>
              <button
                onClick={() => setWidgetSpeaking(false)}
                aria-label="Закрыть приветствие"
              >
                <X size={16} strokeWidth={3} />
              </button>
            </div>
          )}
          <button
            className={`widget-close absolute right-0 top-2 grid place-items-center bg-white w-[22px] h-[22px] rounded-full
            text-[#a093ac] z-3 max-sm:right-[-1px] max-sm:top-[1px] max-sm:w-7 max-sm:h-7 border border-solid
            border-[#eee8f3]`}
            onClick={() => setWidgetVisible(false)}
            aria-label="Скрыть спутника"
          >
            <X size={12} />
          </button>
          <button
            className={`widget-pet flex flex-col items-center bg-transparent w-full cursor-grab touch-none select-none
            [-webkit-user-select:none] max-sm:[&_.pixel-pet]:w-24 max-sm:[&_.pixel-pet]:h-24 p-0`}
            onClick={(event) => {
              if (movement.consumeDragClick()) { actions.dismiss(); return; }
              actions.activate(event.detail > 1);
            }}
            {...movement.handlers}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                if (!event.repeat) actions.activate();
              } else movement.handlers.onKeyDown(event);
            }}
            aria-expanded={actions.menuOpen || actions.wardrobeOpen}
            aria-controls={actions.wardrobeOpen ? "companion-wardrobe" : "companion-actions"}
            title="Нажмите для меню. Двойной клик или два Enter — реплика. Можно перетаскивать."
            aria-label={`Действия спутника ${chosenPet.name}`}
          >
            <PixelPet pet={chosenPet} size={128} paused={paused} />
          </button>
          <CompanionOrbitMenu anchor={movement.ref} position={movement.style} open={actions.menuOpen}
            onAction={(action) => {
              if (action === "chat") actions.chat();
              if (action === "settings") actions.settings();
              if (action === "wardrobe") actions.wardrobe();
            }} />
          <CompanionWardrobe anchor={movement.ref} position={movement.style} open={actions.wardrobeOpen} />
        </div>
      )}
      {chosenPet && !widgetVisible && (
        <button
          className={`restore-buddy fixed bottom-[18px] right-5 flex items-center gap-2 bg-white rounded-[7px] text-[10px]
            text-[#8a769a] z-40 max-sm:text-[9px] border border-solid border-[#e4d9ee] py-[10px] px-[13px]`}
          onClick={() => setWidgetVisible(true)}
        >
          <Volume2 size={15} />
          {chosenPet.name} рядом
        </button>
      )}
    </>
  );
}
