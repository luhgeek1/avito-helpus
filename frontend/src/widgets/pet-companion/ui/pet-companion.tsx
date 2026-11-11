import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { CompanionWardrobe } from "./companion-wardrobe";
import { CompanionOrbitMenu } from "./companion-orbit-menu";
import { CompanionSettings } from "./companion-settings";
import { CompanionChat } from "./companion-chat";
import { CompanionSpotlight } from "./companion-spotlight";
import { useSpotlightShortcut } from "../model/use-spotlight-shortcut";
import { useCompanionChat } from "../model/use-companion-chat";
import { useCompanionActions } from "../model/use-companion-actions";
import { Volume2, X } from "lucide-react";
import { PixelPet, usePetPreferences } from "@/entities/pet";
import { useTypewriter } from "../model/use-typewriter";
import { useDialoguePlacement } from "../model/use-dialogue-placement";
import { useCompanionPosition } from "../model/use-companion-position";
import type { ChatMessage } from "../model/chat-messages";
import { useCompanionTour } from "../model/use-companion-tour";
import { CompanionTourShell } from "./companion-tour";
export function PetCompanion() {
  const { chosenPet, paused, selectionVersion } = usePetPreferences();
  const [widgetVisible, setWidgetVisible] = useState(true);
  const [widgetSpeaking, setWidgetSpeaking] = useState(false);
  const [widgetReply, setWidgetReply] = useState<ChatMessage | null>(null);
  const showGreeting = useCallback((open: boolean) => { setWidgetReply(null); setWidgetSpeaking(open); }, []);
  const movement = useCompanionPosition(Boolean(chosenPet) && widgetVisible);
  const actions = useCompanionActions(movement.ref, showGreeting, movement.dragging, widgetVisible);
  const chat = useCompanionChat();
  const openSpotlight = useCallback(() => { actions.dismiss(); setWidgetSpeaking(false); }, [actions.dismiss]);
  const spotlight = useSpotlightShortcut(Boolean(chosenPet), openSpotlight);
  const tour = useCompanionTour({ movement, actions, spotlight, draft: chat.draft,
    show: () => setWidgetVisible(true), silence: () => setWidgetSpeaking(false) });
  useEffect(() => {
    if (selectionVersion > 0) {
      setWidgetVisible(true);
      setWidgetSpeaking(false);
      actions.dismiss();
    }
  }, [selectionVersion, actions.dismiss]);
  const dialogueText = widgetReply?.text ?? chosenPet?.greeting ?? "";
  const dialogue = useTypewriter(dialogueText, widgetSpeaking && widgetVisible, paused, widgetReply?.id);
  const placement = useDialoguePlacement(movement.ref, widgetSpeaking && widgetVisible,
    movement.style.left, movement.style.top);
  return (
    <CompanionTourShell tour={tour} hideCopy={widgetSpeaking || actions.chatOpen}>
      {chosenPet && spotlight.open && <CompanionSpotlight pet={chosenPet} chat={chat} onClose={spotlight.close}
        onReply={reply => { actions.dismiss(); setWidgetReply(reply); setWidgetVisible(true); setWidgetSpeaking(true); }} />}
      {chosenPet && widgetVisible && (
        <div
          ref={movement.ref}
          className={`companion [&.is-talking_.widget-pet_.pixel-pet]:animate-companion-talk fixed bottom-5 right-[25px] z-35 w-40
            animate-appear max-sm:bottom-3 max-sm:right-[10px] max-sm:w-36 [&.is-dragging_.widget-pet]:cursor-grabbing${movement.dragging ? " is-dragging" : ""}${dialogue.typing && !paused ? " is-talking" : ""}`}
          style={
            {
              ...movement.style,
              width: tour.active ? (tour.viewport.width <= 650 ? 144 : 160) * tour.scale : undefined,
              "--tour-pet-size": `${(tour.viewport.width <= 650 ? 96 : 128) * (tour.active ? tour.scale : 1)}px`,
              "--pet-bg": chosenPet.bg,
              "--pet-color": chosenPet.color,
            } as CSSProperties
          }
        >
          {actions.chatOpen && <CompanionChat anchor={movement.ref} position={movement.style} name={chosenPet.name} chat={chat} topInset={tour.active ? 56 : 0}
            onBack={() => { if (tour.active) tour.visit("menu"); else actions.menu(); movement.ref.current?.querySelector<HTMLButtonElement>(".widget-pet")?.focus(); }}
            onClose={() => { actions.dismiss(); if (tour.active) tour.visit("wardrobe"); movement.ref.current?.querySelector<HTMLButtonElement>(".widget-pet")?.focus(); }} />}
          {actions.settingsOpen && <CompanionSettings anchor={movement.ref} position={movement.style}
            onClose={() => { actions.dismiss(); if (tour.active) tour.visit("spotlight"); }} onHide={() => { actions.dismiss(); setWidgetVisible(false); }} />}
          {widgetSpeaking && (
            <div ref={placement.ref} className={`widget-bubble pixel-dialogue fixed z-36 w-81 max-w-[calc(100vw_-_16px)] pt-3 pb-2 text-[#25252b] bg-[#ffffff]
            rounded-[0] [box-shadow:0_0_0_3px_#cbd3df,_6px_6px_0_3px_#cbd3df26] font-pixel text-[10px] font-normal
            leading-[1.6] [-webkit-font-smoothing:none] animate-dialogue-open max-sm:pt-[10px] max-sm:pb-[6px]
            max-sm:text-[9px] [&[data-side=left]::after]:[content:''] [&[data-side=left]::after]:absolute
            [&[data-side=left]::after]:top-[calc(50%_-_8px)] [&[data-side=left]::after]:w-2 [&[data-side=left]::after]:h-4
            [&[data-side=left]::after]:bg-[#f5f7fa] [&[data-side=left]::after]:[box-shadow:4px_4px_#cbd3df]
            [&[data-side=left]::after]:right-[-12px] [&[data-side=right]::after]:[content:'']
            [&[data-side=right]::after]:absolute [&[data-side=right]::after]:top-[calc(50%_-_8px)]
            [&[data-side=right]::after]:w-2 [&[data-side=right]::after]:h-4 [&[data-side=right]::after]:bg-[#f5f7fa]
            [&[data-side=right]::after]:[box-shadow:4px_4px_#cbd3df] [&[data-side=right]::after]:left-[-12px]
            [&_>_button]:absolute [&_>_button]:top-1 [&_>_button]:right-1 [&_>_button]:grid [&_>_button]:place-items-center
            [&_>_button]:w-8 [&_>_button]:h-8 [&_>_button]:bg-transparent [&_>_button]:text-[#687181]
            [&_>_button:hover]:text-[#25252b] border-[4px] border-solid border-[#f5f7fa] [&_>_button]:p-0 px-3 max-sm:px-[10px]`}
              style={placement.style} data-side={placement.side}>
              <strong className={`dialogue-name block mb-[6px] pr-6 text-[#0079ac] [font-family:inherit] text-[11px] font-[inherit]
            [font-style:inherit] leading-[inherit] max-sm:text-[10px]`}>{chosenPet.name}</strong>
              <div className="dialogue-copy flex gap-2 max-sm:gap-[6px]" aria-hidden="true">
                <span className="dialogue-star text-[#55bfee]">*</span>
                <span className="dialogue-lines grid min-w-[0] [overflow-wrap:anywhere]">
                  <span className="dialogue-reserve [grid-area:1_/_1] invisible">{dialogueText}</span>
                  <span className="dialogue-typed [grid-area:1_/_1] whitespace-pre-wrap">{dialogue.displayed}</span>
                </span>
              </div>
              <span className={`dialogue-accessible absolute w-[1px] h-[1px] overflow-hidden [clip-path:inset(50%)] whitespace-nowrap`} role="status">{dialogueText}</span>
              <div className="dialogue-footer flex items-center justify-end h-4 mt-1 leading-none">
                {dialogue.typing ? (
                  <button className={`dialogue-skip pr-0 pl-2 bg-transparent text-[#687181] [font-family:inherit] text-[8px] font-[inherit]
            [font-style:inherit] leading-[inherit] max-sm:text-[7px] [&:hover]:text-[#25252b] py-0`} onClick={dialogue.complete}>Показать сразу</button>
                ) : <span className="dialogue-ready text-[#008cc7] animate-dialogue-cursor" aria-hidden="true">◆</span>}
              </div>
              <button
                onClick={() => setWidgetSpeaking(false)}
                aria-label={widgetReply ? "Закрыть ответ" : "Закрыть приветствие"}
              >
                <X size={16} strokeWidth={3} />
              </button>
            </div>
          )}
          {!tour.active && <button
            className={`widget-close absolute right-0 top-2 grid place-items-center bg-white w-[22px] h-[22px] rounded-full
            text-[#a093ac] z-3 max-sm:right-[-1px] max-sm:top-[1px] max-sm:w-7 max-sm:h-7 border border-solid
            border-[#eee8f3]`}
            onClick={() => setWidgetVisible(false)}
            aria-label="Скрыть спутника"
          >
            <X size={12} />
          </button>}
          <button
            className={`widget-pet flex flex-col items-center bg-transparent w-full cursor-grab touch-none! select-none
            [-webkit-user-select:none] max-sm:[&_.pixel-pet]:w-24 max-sm:[&_.pixel-pet]:h-24 p-0`}
            onClick={(event) => {
              if (movement.consumeDragClick()) { tour.dragged(); return; }
              if (tour.active && tour.scene === "intro") { tour.visit("menu"); return; }
              actions.activate(event.detail > 1);
            }}
            {...movement.handlers}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                if (!event.repeat) { if (tour.active && tour.scene === "intro") tour.visit("menu"); else actions.activate(); }
              } else { movement.handlers.onKeyDown(event); if (event.key.startsWith("Arrow")) tour.dragged(); }
            }}
            aria-expanded={actions.menuOpen || actions.wardrobeOpen || actions.chatOpen}
            aria-controls={actions.chatOpen ? "companion-chat" : actions.wardrobeOpen ? "companion-wardrobe" : "companion-actions"}
            title="Нажмите для меню. Двойной клик — реплика, два Enter — запрос. Можно перетаскивать."
            aria-label={`Действия спутника ${chosenPet.name}`}
          >
            <PixelPet pet={chosenPet} size={128} paused={paused} className={tour.active ? "[width:var(--tour-pet-size)]! [height:var(--tour-pet-size)]!" : ""} />
          </button>
          <CompanionOrbitMenu anchor={movement.ref} position={movement.style} open={actions.menuOpen}
            onAction={(action) => {
              if (tour.active) { tour.visit(action); return; }
              if (action === "chat") actions.chat();
              if (action === "settings") actions.settings();
              if (action === "wardrobe") actions.wardrobe();
            }} />
          <CompanionWardrobe anchor={movement.ref} position={movement.style} open={actions.wardrobeOpen} semicircle={tour.active && tour.scene === "wardrobe"} />
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
    </CompanionTourShell>
  );
}
