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
      className={`favorite-button ${isFavorite ? "is-favorite" : ""} ${showLabel ? "with-label" : ""}`}
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
