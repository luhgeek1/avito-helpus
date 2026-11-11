import { Pause, Play } from "lucide-react";
import { usePetPreferences } from "@/entities/pet";
export function TogglePetAnimation() {
  const { paused, setPaused } = usePetPreferences();
  return (
    <button
      className={`animation-toggle flex gap-[6px] items-center text-[11px] text-[#7c7187] bg-transparent pr-0 pl-[7px]
            max-sm:bg-white max-sm:pl-0 max-sm:h-11 max-sm:w-11 max-sm:justify-center max-sm:rounded-[7px]
            [&.paused]:text-[#7760c4] max-lg:[&_span]:hidden max-sm:border max-sm:border-solid max-sm:border-[var(--line)]
            py-2 max-sm:py-0 ${paused ? "paused" : ""}`}
      onClick={() => setPaused(!paused)}
      aria-label={paused ? "Включить анимацию" : "Приостановить анимацию"}
      aria-pressed={paused}
    >
      {paused ? <Play size={15} /> : <Pause size={15} />}
      <span>{paused ? "Оживить" : "Анимация"}</span>
    </button>
  );
}
