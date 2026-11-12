import { Pause, Play } from "lucide-react";
import { usePetPreferences } from "@/entities/pet";
import { cx } from "@/shared/lib/cx";
export function TogglePetAnimation() {
  const { paused, setPaused } = usePetPreferences();
  return (
    <button
      className={cx(
        "flex items-center gap-1.5 bg-transparent py-2 pr-0 pl-1.75 text-11 text-[#7c7187] max-md:mt-0 max-md:shrink-0",
        "max-sm:size-11 max-sm:justify-center max-sm:rounded-[7px] max-sm:border max-sm:border-line max-sm:bg-white max-sm:py-0 max-sm:pl-0",
        paused && "text-lilac",
      )}
      onClick={() => setPaused(!paused)}
      aria-label={paused ? "Включить анимацию" : "Приостановить анимацию"}
      aria-pressed={paused}
    >
      {paused ? <Play size={15} /> : <Pause size={15} />}
      <span className="max-lg:hidden">{paused ? "Оживить" : "Анимация"}</span>
    </button>
  );
}
