import { useState } from "react";
import type { CSSProperties } from "react";
import { Maximize2, Sparkles } from "lucide-react";
import { PixelPet, usePetPreferences } from "@/entities/pet";
import type { Pet } from "@/entities/pet";
import { FavoritePetButton } from "@/features/pet/favorite";
import { ChoosePetButton } from "@/features/pet/choose";
import { DownloadPetButton } from "@/features/pet/download";
import { GreetPetButton, usePetGreeting } from "@/features/pet/greet";
export function PetInspector({ pet: active }: { pet: Pet }) {
  const [scale, setScale] = useState(2);
  const { paused } = usePetPreferences();
  const { speaking, greet } = usePetGreeting();
  return (
    <aside className="pet-detail" aria-label="Знакомство с выбранным петом">
      <div className="detail-heading">
        <span>ПОЗНАКОМИМСЯ?</span>
        <button
          className="detail-mobile-back"
          onClick={() =>
            document
              .querySelector(".collection-toolbar")
              ?.scrollIntoView({ block: "start" })
          }
        >
          К коллекции ↑
        </button>
        <span className="detail-online">
          <i />
          Рядом
        </span>
      </div>
      <div
        className="detail-stage"
        style={
          {
            "--pet-bg": active.bg,
            "--pet-color": active.color,
          } as CSSProperties
        }
      >
        <span className="detail-orbit orbit-one" />
        <span className="detail-orbit orbit-two" />
        {speaking && (
          <div className="speech-bubble" role="status">
            {active.greeting}
          </div>
        )}
        <div className="detail-pet-space">
          <span className="ground-shadow" />
          <PixelPet
            key={active.id}
            pet={active}
            size={scale === 1 ? 128 : scale === 2 ? 160 : 192}
            paused={paused}
          />
        </div>
        <span className="detail-stage-label">
          {paused
            ? "тихий режим"
            : active.category === "orbi" || active.id === "orbit"
              ? "на орбите и рядом"
              : "чувствует себя как дома"}
        </span>
      </div>
      <div className="scale-toolbar">
        <span>
          <Maximize2 size={13} />
          Масштаб
        </span>
        <div aria-label="Масштаб персонажа">
          {[1, 2, 3].map((s) => (
            <button
              key={s}
              onClick={() => setScale(s)}
              className={s === scale ? "selected" : ""}
              aria-label={`Масштаб ${s}×`}
              aria-pressed={s === scale}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>
      <div className="detail-copy">
        <div className="detail-name">
          <h2>{active.name}</h2>
          <span>{active.kind}</span>
        </div>
        <p>{active.description}</p>
        <span className="personality">{active.personality}</span>
        <div className="palette-row">
          <span>Его цвета</span>
          <div>
            {active.palette.map((c) => (
              <span key={c} style={{ background: c }} title={c} />
            ))}
          </div>
        </div>
        <ChoosePetButton pet={active} />
        <FavoritePetButton pet={active} showLabel />
        <div className="detail-actions">
          <GreetPetButton onGreet={greet} />
          <DownloadPetButton pet={active} />
        </div>
      </div>
      <div className="detail-footnote">
        <Sparkles size={14} />
        <span>Маленький пет, большая поддержка.</span>
      </div>
    </aside>
  );
}
