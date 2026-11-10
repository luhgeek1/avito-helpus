import { Pause, Play } from "lucide-react";
import { usePetPreferences } from "@/entities/pet";
export function TogglePetAnimation() {
  const { paused, setPaused } = usePetPreferences();
  return (
    <button
      className={`animation-toggle ${paused ? "paused" : ""}`}
      onClick={() => setPaused(!paused)}
      aria-label={paused ? "Включить анимацию" : "Приостановить анимацию"}
      aria-pressed={paused}
    >
      {paused ? <Play size={15} /> : <Pause size={15} />}
      <span>{paused ? "Оживить" : "Анимация"}</span>
    </button>
  );
}
