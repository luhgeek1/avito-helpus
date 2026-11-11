import { Heart } from "lucide-react";
import { usePetPreferences } from "@/entities/pet";
import type { Pet } from "@/entities/pet";

export function FavoritePetButton({
  pet,
  showLabel = false,
}: {
  pet: Pet;
  showLabel?: boolean;
}) {
  const { favoriteIds, toggleFavorite } = usePetPreferences();
  const isFavorite = favoriteIds.includes(pet.id);
  const label = `${isFavorite ? "Убрать из избранного" : "В избранное"}: ${pet.name}`;
  return (
    <button
      type="button"
      className={`favorite-button inline-flex items-center justify-center gap-2 w-11 h-11 rounded-[9px] bg-white text-[#94819f]
            [transition:color_150ms,_background_150ms] [&:hover]:text-[#be668d] [&:hover]:bg-[#fdf1f6]
            [&.is-favorite]:text-[#bd5f89] [&.with-label]:w-full [&.with-label]:h-10 [&.with-label]:mt-2
            [&.with-label]:rounded-[6px] [&.with-label]:text-[#8b779a] [&.with-label]:text-[10px]
            max-sm:[&.with-label]:h-11 max-sm:[&.with-label]:text-[9px] [&.with-label.is-favorite]:bg-[#fff2f7]
            [&.with-label.is-favorite]:text-[#b75f86] [&.with-label]:border [&.with-label]:border-solid
            [&.with-label]:border-[#ebe5ef] [&.with-label.is-favorite]:border-[#efd7e2] p-0 ${isFavorite ? "is-favorite" : ""}  ${showLabel ? "with-label" : ""}`}
      onClick={() => toggleFavorite(pet.id)}
      aria-label={label}
      aria-pressed={isFavorite}
      title={label}
    >
      <Heart
        size={18}
        strokeWidth={1.7}
        fill={isFavorite ? "currentColor" : "none"}
      />
      {showLabel && <span>{isFavorite ? "В избранном" : "В избранное"}</span>}
    </button>
  );
}
