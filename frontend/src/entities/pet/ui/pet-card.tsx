import { ArrowRight, Check } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import type { Pet } from "../model/types";
import { PixelPet } from "./pixel-pet";
interface PetCardProps {
  pet: Pet;
  number: number;
  selected: boolean;
  chosen: boolean;
  paused: boolean;
  onSelect: (pet: Pet) => void;
  actions?: ReactNode;
}
export function PetCard({
  pet,
  number,
  selected,
  chosen,
  paused,
  onSelect,
  actions,
}: PetCardProps) {
  return (
    <article
      className={`pet-card ${selected ? "is-active" : ""} ${actions ? "has-actions" : ""}`}
      style={
        {
          "--pet-bg": pet.bg,
          "--pet-color": pet.color,
        } as CSSProperties
      }
    >
      <button
        type="button"
        className="pet-card-preview"
        onClick={() => onSelect(pet)}
        aria-label={`Рассмотреть: ${pet.kind} ${pet.name}`}
        aria-pressed={selected}
      >
        <div className="card-stage">
          <span className="pet-number">{String(number).padStart(2, "0")}</span>
          {chosen ? (
            <span className="adopted-label">
              <Check size={11} />
              Твой бадди
            </span>
          ) : selected ? (
            <span className="card-check">
              <Check size={12} />
            </span>
          ) : null}
          <div className="pixel-spark spark-one" />
          <div className="pixel-spark spark-two" />
          <span className="ground-shadow" />
          <PixelPet pet={pet} size={128} paused={paused} />
          <span className="stage-ground" />
        </div>
        <div className="card-info">
          <div>
            <h2>{pet.name}</h2>
            <span>{pet.kind}</span>
          </div>
          {!actions && (
            <span className="card-arrow">
              <ArrowRight size={17} />
            </span>
          )}
        </div>
      </button>
      {actions && <div className="pet-card-actions">{actions}</div>}
    </article>
  );
}
