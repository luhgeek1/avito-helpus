import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
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
  useEffect(() => {
    if (selectionVersion > 0) {
      setWidgetVisible(true);
      setWidgetSpeaking(true);
    }
  }, [selectionVersion]);
  const dialogue = useTypewriter(chosenPet?.greeting ?? "", widgetSpeaking && widgetVisible, paused);
  const placement = useDialoguePlacement(movement.ref, widgetSpeaking && widgetVisible,
    movement.style.left, movement.style.top);
  return (
    <>
      {chosenPet && widgetVisible && (
        <div
          ref={movement.ref}
          className={`companion${movement.dragging ? " is-dragging" : ""}${dialogue.typing && !paused ? " is-talking" : ""}`}
          style={
            {
              ...movement.style,
              "--pet-bg": chosenPet.bg,
              "--pet-color": chosenPet.color,
            } as CSSProperties
          }
        >
          {widgetSpeaking && (
            <div ref={placement.ref} className="widget-bubble pixel-dialogue"
              style={placement.style} data-side={placement.side}>
              <strong className="dialogue-name">{chosenPet.name}</strong>
              <div className="dialogue-copy" aria-hidden="true">
                <span className="dialogue-star">*</span>
                <span className="dialogue-lines">
                  <span className="dialogue-reserve">{chosenPet.greeting}</span>
                  <span className="dialogue-typed">{dialogue.displayed}</span>
                </span>
              </div>
              <span className="dialogue-accessible" role="status">{chosenPet.greeting}</span>
              <div className="dialogue-footer">
                {dialogue.typing ? (
                  <button className="dialogue-skip" onClick={dialogue.complete}>Показать сразу</button>
                ) : <span className="dialogue-ready" aria-hidden="true">◆</span>}
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
            className="widget-close"
            onClick={() => setWidgetVisible(false)}
            aria-label="Скрыть спутника"
          >
            <X size={12} />
          </button>
          <button
            className="widget-pet"
            onClick={() => {
              if (!movement.consumeDragClick()) setWidgetSpeaking(!widgetSpeaking);
            }}
            {...movement.handlers}
            title="Перетащите спутника или перемещайте стрелками клавиатуры"
            aria-label={`Поговорить с ${chosenPet.name}`}
          >
            <PixelPet pet={chosenPet} size={128} paused={paused} />
          </button>
        </div>
      )}
      {chosenPet && !widgetVisible && (
        <button
          className="restore-buddy"
          onClick={() => setWidgetVisible(true)}
        >
          <Volume2 size={15} />
          {chosenPet.name} рядом
        </button>
      )}
    </>
  );
}
