import { useState } from "react";
import { Heart } from "lucide-react";
import { PetCard, pets, defaultPet, usePetPreferences } from "@/entities/pet";
import type { Pet } from "@/entities/pet";
import { FavoritePetButton } from "@/features/pet/favorite";
import { TogglePetAnimation } from "@/features/pet/toggle-animation";
import { cx } from "@/shared/lib/cx";
type Filter = "orbi" | "previous" | "all" | "favorites";
const orbiVariants = pets.filter(
  (pet) => pet.category === "orbi" && pet.id !== defaultPet.id,
);
const orbiPets = [defaultPet, ...orbiVariants];
const filterButton = cx(
  "rounded-[7px] bg-transparent px-3 py-2.25 text-11 whitespace-nowrap text-[#766c80] max-sm:min-h-11 max-sm:py-2.5",
  "max-xs:px-2 xs:max-sm:px-2.75 sm:max-md:min-h-9.5 sm:max-md:p-2 md:max-lg:p-2",
);
const filterButtonSelected = cx(
  "border border-[#e7e4ec] bg-white px-2.75 py-2 text-[#51485e] shadow-[0_1px_4px_#3320470b] max-sm:py-2.25",
  "max-xs:px-1.75 xs:max-sm:px-2.5 sm:max-md:p-1.75 md:max-lg:p-1.75",
);
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
    <section className="max-xs:w-full xs:max-sm:w-full" aria-label="Коллекция петов">
      <div className="collection-toolbar mb-5 flex min-h-8.5 items-center justify-between gap-2.5 max-md:items-start
            max-sm:mb-3.75 max-sm:scroll-mt-20 max-sm:gap-1.25 xl:mb-5.5">
        <div
          className="flex items-center gap-1 max-md:grid max-md:flex-1 max-md:grid-cols-2"
          aria-label="Фильтр персонажей"
        >
          {filters.map(({ value, label }) => (
            <button
              key={value}
              className={cx(filterButton, filter === value && filterButtonSelected)}
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
        <div className="grid grid-cols-3 gap-4.25 max-lg:grid-cols-2 max-md:gap-3 xl:gap-5">
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
        <div
          className="flex min-h-75 flex-col items-center justify-center rounded-[13px] border border-[#e8e3ee] bg-white px-5
            py-8.75 text-center text-[#b58ba5]"
          role="status"
        >
          <Heart size={27} strokeWidth={1.4} />
          <h2 className="mt-4.25 text-17 font-[550] text-[#63556e]">Пока нет избранных</h2>
          <p className="mt-3 text-11 leading-[1.9] text-[#95869f]">
            Нажимай на сердечко у понравившихся вариантов.
            <br />
            Они соберутся здесь — будет проще выбрать своего.
          </p>
          <button
            className="mt-5 min-h-11 rounded-[7px] bg-[#f0eaf8] px-4 py-2.5 text-11 text-[#81679c]"
            onClick={() => setFilter("orbi")}
          >
            Посмотреть Орби
          </button>
        </div>
      )}
      <div className="mt-5.5 flex items-center justify-between gap-3.75 text-9 text-[#82788d] max-sm:mt-4.25 max-sm:text-8">
        <span className="flex items-center gap-1.75 max-md:leading-[1.7] max-xs:max-w-36.25 xs:max-sm:max-w-51.25
            sm:max-md:max-w-37.5">
          <span className="inline-block size-1 shrink-0 bg-[#c8bfd6]" />
          {filter === "favorites"
            ? "Те, кто тебе приглянулся."
            : "У каждого — свой характер. Как у нас."}
        </span>
        <span className="max-md:whitespace-nowrap">
          {list.length} из {pets.length} персонажей
        </span>
      </div>
    </section>
  );
}
