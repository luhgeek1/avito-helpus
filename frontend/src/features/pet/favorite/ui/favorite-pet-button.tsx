import { Heart } from "lucide-react";
import { usePetPreferences } from "@/entities/pet";
import type { Pet } from "@/entities/pet";
import { cx } from "@/shared/lib/cx";

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
      className={cx(
        "inline-flex size-11 items-center justify-center gap-2 rounded-[9px] bg-white p-0 text-[#94819f]",
        "transition-[color,background] duration-150 hover:bg-[#fdf1f6] hover:text-[#be668d]",
        isFavorite && "text-[#bd5f89]",
        showLabel && "mt-2 h-10 w-full rounded-md border border-[#ebe5ef] text-10 text-[#8b779a] max-sm:h-11 max-sm:text-9",
        showLabel && isFavorite && "border-[#efd7e2] bg-[#fff2f7] text-[#b75f86]",
      )}
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
