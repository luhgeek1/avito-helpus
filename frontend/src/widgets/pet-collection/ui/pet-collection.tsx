import { useState } from "react";
import { Heart } from "lucide-react";
import { PetCard, pets, defaultPet, usePetPreferences } from "@/entities/pet";
import type { Pet } from "@/entities/pet";
import { FavoritePetButton } from "@/features/pet/favorite";
import { TogglePetAnimation } from "@/features/pet/toggle-animation";
type Filter = "orbi" | "previous" | "all" | "favorites";
const orbiVariants = pets.filter(
  (pet) => pet.category === "orbi" && pet.id !== defaultPet.id,
);
const orbiPets = [defaultPet, ...orbiVariants];
const previousCount = pets.filter((pet) => pet.category !== "orbi").length;

export function PetCollection({
  activeId,
  onSelect,
}: {
  activeId: string;
  onSelect: (pet: Pet) => void;
}) {
  const [filter, setFilter] = useState<Filter>("orbi");
  const { chosenPet, paused, favoriteIds } = usePetPreferences();
  const filters: { value: Filter; label: string }[] = [
    { value: "orbi", label: `Орби · ${orbiPets.length}` },
    { value: "previous", label: `Раньше · ${previousCount}` },
    { value: "all", label: `Все · ${pets.length}` },
    { value: "favorites", label: `Избранные · ${favoriteIds.length}` },
  ];
  const list = (filter === "orbi" ? orbiPets : pets).filter((pet) => {
    if (filter === "favorites") return favoriteIds.includes(pet.id);
    if (filter === "all") return true;
    return filter === "orbi" || pet.category !== "orbi";
  });
  return (
    <section className="collection" aria-label="Коллекция петов">
      <div className="collection-toolbar">
        <div className="filters" aria-label="Фильтр персонажей">
          {filters.map(({ value, label }) => (
            <button
              key={value}
              className={filter === value ? "selected" : ""}
              onClick={() => setFilter(value)}
              aria-pressed={filter === value}
            >
              {label}
            </button>
          ))}
        </div>
        <TogglePetAnimation />
      </div>
      {list.length ? (
        <div className="pet-grid">
          {list.map((pet) => (
            <PetCard
              key={pet.id}
              pet={pet}
              number={pets.indexOf(pet) + 1}
              selected={activeId === pet.id}
              chosen={chosenPet?.id === pet.id}
              paused={paused}
              onSelect={onSelect}
              actions={<FavoritePetButton pet={pet} />}
            />
          ))}
        </div>
      ) : (
        <div className="collection-empty" role="status">
          <Heart size={27} strokeWidth={1.4} />
          <h2>Пока нет избранных</h2>
          <p>
            Нажимай на сердечко у понравившихся вариантов.
            <br />
            Они соберутся здесь — будет проще выбрать своего.
          </p>
          <button onClick={() => setFilter("orbi")}>Посмотреть Орби</button>
        </div>
      )}
      <div className="collection-footer">
        <span>
          <span className="tiny-pixel" />
          {filter === "favorites"
            ? "Те, кто тебе приглянулся."
            : "У каждого — свой характер. Как у нас."}
        </span>
        <span>
          {list.length} из {pets.length} персонажей
        </span>
      </div>
    </section>
  );
}
