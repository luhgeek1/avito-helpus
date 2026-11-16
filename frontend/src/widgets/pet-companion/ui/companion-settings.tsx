import { useEffect, useRef } from "react";
import type { CSSProperties, RefObject } from "react";
import { ChevronRight, EyeOff, RotateCcw, X } from "lucide-react";
import { usePetPreferences } from "@/entities/pet";
import { cx } from "@/shared/lib/cx";
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
      className="companion-settings fixed z-40 overflow-hidden rounded-2xl border-2 border-dark bg-white font-sans text-ink
        shadow-pop animate-appear motion-reduce:animate-none">
      <div className="flex items-center justify-between gap-2 border-b border-line py-1.5 pl-5 pr-2">
        <h2 className="text-14 font-semibold text-dark">Настройки</h2>
        <button ref={closeButton} type="button" onClick={onClose} aria-label="Закрыть настройки"
          className="grid size-11 shrink-0 place-items-center rounded-xl bg-transparent text-secondary hover:bg-control hover:text-dark focus-visible:outline-2 focus-visible:outline-dark">
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <div className="p-2">
        <button type="button" role="switch" aria-label="Анимация" aria-checked={!paused} onClick={() => setPaused(!paused)}
          className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl bg-transparent px-3 py-2 text-left hover:bg-control focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-dark">
          <span><span className="block text-13 font-semibold text-dark">Анимация</span>
            <span className="block text-11 leading-4 text-secondary">{paused ? "На паузе" : "Движения и эмоции"}</span></span>
          <span aria-hidden="true" className={cx("h-6 w-10 shrink-0 rounded-full p-0.5 transition-colors duration-150 motion-reduce:transition-none", paused ? "bg-secondary" : "bg-blue-text")}>
            <span className={cx("block size-5 rounded-full bg-white shadow-sm transition-transform duration-150 motion-reduce:transition-none", !paused && "translate-x-4")} />
          </span>
        </button>
        <button type="button" onClick={() => { onClose(); onboarding.start(); }}
          className="flex min-h-11 w-full items-center gap-3 rounded-xl bg-transparent px-3 py-2 text-left text-13 font-medium hover:bg-control focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-dark">
          <RotateCcw size={17} className="shrink-0 text-secondary" aria-hidden="true" />
          <span className="flex-1">Знакомство с петом</span><ChevronRight size={16} className="shrink-0 text-secondary" aria-hidden="true" />
        </button>
        <div className="mt-1 border-t border-line pt-1">
          <button type="button" onClick={onHide}
            className="flex min-h-11 w-full items-center gap-3 rounded-xl bg-transparent px-3 py-2 text-left text-13 font-medium text-[#b33e4d] hover:bg-[#fff3f3] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#b33e4d]">
            <EyeOff size={17} className="shrink-0" aria-hidden="true" />Скрыть спутника
          </button>
        </div>
      </div>
    </div>
  );
}
