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
import { ArrowUpRight, X } from "lucide-react";
import { PixelPet, usePetPreferences } from "@/entities/pet";
import { useTypewriter } from "../model/use-typewriter";
import { useDialoguePlacement } from "../model/use-dialogue-placement";
import { useCompanionPosition } from "../model/use-companion-position";
import type { ChatMessage } from "../model/chat-messages";
import { useCompanionTour } from "../model/use-companion-tour";
import { CompanionTourShell } from "./companion-tour";
import { cx } from "@/shared/lib/cx";
import { useOrbiNotice, useSession } from "@/shared/api";
export function PetCompanion({ guideMode = false }: { guideMode?: boolean }) {
  const { chosenPet, paused, selectionVersion } = usePetPreferences();
  const [widgetVisible, setWidgetVisible] = useState(true);
  const [widgetSpeaking, setWidgetSpeaking] = useState(false);
  const [widgetReply, setWidgetReply] = useState<ChatMessage | null>(null);
  const showGreeting = useCallback((open: boolean) => { setWidgetReply(null); setWidgetSpeaking(open); }, []);
  const movement = useCompanionPosition(Boolean(chosenPet) && widgetVisible);
  const actions = useCompanionActions(movement.ref, showGreeting, movement.dragging, widgetVisible);
  const chat = useCompanionChat(guideMode);
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
  const openSignal = chat.openSignal;
  const openChat = actions.chat;
  useEffect(() => {
    if (!openSignal) return;
    setWidgetVisible(true);
    openChat();
  }, [openSignal]); // Only a new signal opens the chat.
  const notice = useOrbiNotice((state) => state.notice);
  const chatOpen = actions.chatOpen;
  const accountEpoch = useSession((state) => state.epoch);
  const sessionStatus = useSession((state) => state.status);
  useEffect(() => {
    if (guideMode) return;
    setWidgetReply(null);
    setWidgetSpeaking(false);
    actions.dismiss();
  }, [accountEpoch, sessionStatus, guideMode, actions.dismiss]);
  useEffect(() => {
    setWidgetReply(null);
    setWidgetSpeaking(false);
    actions.dismiss();
    spotlight.close();
  }, [guideMode, actions.dismiss]);
  useEffect(() => {
    if (guideMode || !notice || chatOpen || tour.active) return;
    setWidgetReply({ id: notice.id, text: notice.body ? `${notice.title}\n${notice.body}` : notice.title });
    setWidgetVisible(true);
    setWidgetSpeaking(true);
  }, [notice]); // Speak once per new notification.
  const dialogueText = widgetReply?.text ?? chosenPet?.greeting ?? "";
  const dialogue = useTypewriter(dialogueText, widgetSpeaking && widgetVisible, paused, widgetReply?.id);
  const placement = useDialoguePlacement(movement.ref, widgetSpeaking && widgetVisible,
    movement.style.left, movement.style.top);
  return (
    <CompanionTourShell tour={tour} hideCopy={widgetSpeaking || actions.chatOpen}>
      {chosenPet && spotlight.open && <CompanionSpotlight key={guideMode ? "guide" : "workspace"} pet={chosenPet} chat={chat} onClose={spotlight.close}
        onReply={reply => { actions.dismiss(); setWidgetReply(reply); setWidgetVisible(true); setWidgetSpeaking(true); }}
        onOpenChat={() => { spotlight.close(); setWidgetVisible(true); actions.chat(); }} />}
      {chosenPet && widgetVisible && (
        <div
          ref={movement.ref}
          className="companion fixed right-6.25 bottom-5 z-35 w-40 animate-appear max-sm:right-2.5 max-sm:bottom-3 max-sm:w-36"
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
          {actions.chatOpen && <CompanionChat name={chosenPet.name} chat={chat} topInset={tour.active ? 56 : 0}
            onBack={() => { if (tour.active) tour.visit("menu"); else actions.menu(); movement.ref.current?.querySelector<HTMLButtonElement>(".widget-pet")?.focus(); }}
            onClose={() => { actions.dismiss(); if (tour.active) tour.visit("wardrobe"); movement.ref.current?.querySelector<HTMLButtonElement>(".widget-pet")?.focus(); }} />}
          {actions.settingsOpen && <CompanionSettings anchor={movement.ref} position={movement.style}
            onClose={() => { actions.dismiss(); if (tour.active) tour.visit("spotlight"); }} onHide={() => { actions.dismiss(); setWidgetVisible(false); }} />}
          {widgetSpeaking && (
            <div
              ref={placement.ref}
              className="pixel-dialogue fixed z-36 w-81 max-w-[calc(100vw-16px)] rounded-none border-4 border-[#f5f7fa] bg-white
            px-3 pt-3 pb-2 font-pixel text-10 leading-[1.6] font-normal text-ink shadow-[0_0_0_3px_#cbd3df,6px_6px_0_3px_#cbd3df26]
            [-webkit-font-smoothing:none] animate-dialogue-open max-sm:px-2.5 max-sm:pt-2.5 max-sm:pb-1.5 max-sm:text-9
            data-side:after:absolute data-side:after:top-[calc(50%-8px)] data-side:after:h-4 data-side:after:w-2
            data-side:after:bg-[#f5f7fa] data-side:after:shadow-[4px_4px_#cbd3df] data-side:after:content-['']
            data-[side=left]:after:-right-3 data-[side=right]:after:-left-3"
              style={placement.style} data-side={placement.side}>
              <strong className="mb-1.5 block pr-6 text-11 leading-[inherit] font-[inherit] text-[#0079ac] [font-family:inherit]
            [font-style:inherit] max-sm:text-10">{chosenPet.name}</strong>
              <div className="flex gap-2 max-sm:gap-1.5" aria-hidden="true">
                <span className="text-[#55bfee]">*</span>
                <span className="grid min-w-0 wrap-anywhere">
                  <span className="invisible col-start-1 row-start-1">{dialogueText}</span>
                  <span className="col-start-1 row-start-1 whitespace-pre-wrap">{dialogue.displayed}</span>
                </span>
              </div>
              <span className="absolute h-px w-px overflow-hidden whitespace-nowrap [clip-path:inset(50%)]" role="status">{dialogueText}</span>
              <div className="mt-1 flex h-4 items-center justify-end leading-none">
                {dialogue.typing ? (
                  <button
                    className="bg-transparent py-0 pr-0 pl-2 text-8 leading-[inherit] font-[inherit] text-[#687181] [font-family:inherit]
            [font-style:inherit] hover:text-ink max-sm:text-7"
                    onClick={dialogue.complete}
                  >Показать сразу</button>
                ) : <span className="animate-dialogue-cursor text-[#008cc7]" aria-hidden="true">◆</span>}
              </div>
              <button
                className="absolute top-1 right-1 grid size-8 place-items-center bg-transparent p-0 text-[#687181] hover:text-ink"
                onClick={() => setWidgetSpeaking(false)}
                aria-label={widgetReply ? "Закрыть ответ" : "Закрыть приветствие"}
              >
                <X size={16} strokeWidth={3} />
              </button>
            </div>
          )}
          <button
            className={cx(
              "widget-pet flex w-full touch-none! flex-col items-center bg-transparent p-0 select-none [-webkit-user-select:none]",
              movement.dragging ? "cursor-grabbing" : "cursor-grab",
              actions.chatOpen && "relative z-41 max-sm:z-auto [@media(max-height:430px)]:z-auto",
            )}
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
            <PixelPet
              pet={chosenPet}
              size={128}
              paused={paused}
              className={cx(
                tour.active ? "size-(--tour-pet-size)" : "max-sm:size-24",
                dialogue.typing && !paused && "animate-companion-talk",
              )}
            />
          </button>
          <CompanionOrbitMenu anchor={movement.ref} position={movement.style} open={actions.menuOpen}
            chatOpen={actions.chatOpen} onChat={() => {
              if (actions.chatOpen) actions.dismiss();
              else if (tour.active && tour.scene !== "chat") tour.visit("chat");
              else actions.chat();
            }}
            onAction={(action) => {
              if (action === "hide") {
                actions.dismiss();
                if (tour.active) void tour.finish().then(() => setWidgetVisible(false));
                else setWidgetVisible(false);
                return;
              }
              if (tour.active) { tour.visit(action); return; }
              if (action === "settings") actions.settings();
              if (action === "wardrobe") actions.wardrobe();
            }} />
          <CompanionWardrobe anchor={movement.ref} position={movement.style} open={actions.wardrobeOpen} semicircle={tour.active && tour.scene === "wardrobe"} />
        </div>
      )}
      {chosenPet && !widgetVisible && (
        <button
          type="button" aria-label={`Вернуть спутника ${chosenPet.name}`}
          className="fixed right-5 bottom-4.5 z-40 flex min-h-14 max-w-[calc(100vw-32px)] items-center gap-3 rounded-2xl
            border border-[#383c6226] bg-white py-2 pl-2 pr-3 text-left shadow-[3px_3px_0_#383c6214]
            transition-colors duration-150 hover:border-[#383c6280] hover:bg-[#f8f9fc]
            focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#383c62] motion-reduce:transition-none max-sm:right-4"
          onClick={() => setWidgetVisible(true)}
        >
          <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-xl" style={{ backgroundColor: chosenPet.bg }}>
            <PixelPet pet={chosenPet} size={32} paused />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-13 font-semibold leading-5 text-[#383c62]">{chosenPet.name}</span>
            <span className="block text-11 leading-4 text-[#687181]">Вернуть на экран</span>
          </span>
          <ArrowUpRight size={17} className="shrink-0 text-[#687181]" aria-hidden="true" />
        </button>
      )}
    </CompanionTourShell>
  );
}
