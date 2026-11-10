import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { Volume2, X } from "lucide-react";
import { PixelPet, usePetPreferences } from "@/entities/pet";
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
  useEffect(() => {
    if (!widgetSpeaking) return;
    const timer = setTimeout(() => setWidgetSpeaking(false), 7000);
    return () => clearTimeout(timer);
  }, [widgetSpeaking, selectionVersion]);
  return (
    <>
      {chosenPet && widgetVisible && (
        <div
          ref={movement.ref}
          className={`companion${movement.dragging ? " is-dragging" : ""}`}
          style={
            {
              ...movement.style,
              "--pet-bg": chosenPet.bg,
              "--pet-color": chosenPet.color,
            } as CSSProperties
          }
        >
          {widgetSpeaking && (
            <div className="widget-bubble" style={movement.bubbleStyle} role="status">
              <strong>{chosenPet.name} теперь рядом!</strong>
              <span>{chosenPet.greeting}</span>
              <button
                onClick={() => setWidgetSpeaking(false)}
                aria-label="Закрыть приветствие"
              >
                <X size={13} />
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
