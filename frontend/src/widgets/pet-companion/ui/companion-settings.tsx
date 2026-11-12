import { useEffect, useRef } from "react";
import type { CSSProperties, RefObject } from "react";
import { X } from "lucide-react";
import { usePetPreferences } from "@/entities/pet";
import { useDialoguePlacement } from "../model/use-dialogue-placement";
import { usePetOnboarding } from "@/features/pet/onboarding";

export function CompanionSettings({ anchor, position, onClose, onHide }: {
  anchor: RefObject<HTMLDivElement | null>; position: CSSProperties;
  onClose: () => void; onHide: () => void;
}) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const { paused, setPaused } = usePetPreferences();
  const onboarding = usePetOnboarding();
  const placement = useDialoguePlacement(anchor, true, position.left, position.top);
  useEffect(() => {
    if (placement.style.visibility !== "hidden") closeButton.current?.focus();
  }, [placement.style.visibility]);
  return (
    <div ref={placement.ref} style={placement.style} role="dialog" aria-label="Настройки спутника"
      className="companion-settings fixed z-40 border-4 border-[#e9e5ff] bg-[#303552] p-3 text-[#faf7ff]
        shadow-[0_0_0_3px_#373b60] animate-dialogue-open">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="font-pixel text-10">Настройки</h2>
        <button ref={closeButton} className="grid size-8 place-items-center bg-transparent" onClick={onClose} aria-label="Закрыть настройки">
          <X size={16} />
        </button>
      </div>
      <button role="switch" aria-checked={!paused} onClick={() => setPaused(!paused)}
        className="flex min-h-11 w-full items-center justify-between gap-2 bg-[#414667] px-3 text-12">
        Анимация <span className="text-[#9de1f3]">{paused ? "Выкл" : "Вкл"}</span>
      </button>
      <button onClick={() => { onClose(); onboarding.start(); }}
        className="mt-2 min-h-11 w-full bg-[#414667] px-3 text-left text-12">Знакомство с петом</button>
      <button onClick={onHide} className="mt-2 min-h-11 w-full bg-transparent text-left text-12 text-[#eeb1d0]">
        Скрыть спутника
      </button>
    </div>
  );
}
