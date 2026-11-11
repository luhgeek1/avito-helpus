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
    <section className="collection max-xs:w-[100%] xs:max-sm:w-[100%]" aria-label="Коллекция петов">
      <div className={`collection-toolbar flex justify-between items-center mb-5 gap-[10px] min-h-[34px] max-md:items-start
            max-sm:mb-[15px] max-sm:gap-[5px] max-sm:[scroll-margin-top:80px] xl:mb-[22px]
            max-md:[&_>_.animation-toggle]:mt-0 max-md:[&_>_.animation-toggle]:shrink-0`}>
        <div className={`filters flex gap-1 items-center max-md:grid max-md:[grid-template-columns:repeat(2,_minmax(0,_1fr))]
            max-md:[flex:1] [&_button]:text-[11px] [&_button]:bg-transparent [&_button]:text-[#766c80]
            [&_button]:rounded-[7px] [&_button]:whitespace-nowrap max-sm:[&_button]:min-h-11
            sm:max-md:[&_button]:min-h-[38px] [&_button.selected]:bg-white [&_button.selected]:text-[#51485e]
            [&_button.selected]:[box-shadow:0_1px_4px_#3320470b] [&_button.selected]:border
            [&_button.selected]:border-solid [&_button.selected]:border-[#e7e4ec] sm:max-md:[&_button]:p-2
            md:max-lg:[&_button]:p-2 sm:max-md:[&_button.selected]:p-[7px] md:max-lg:[&_button.selected]:p-[7px]
            [&_button]:py-[9px] max-sm:[&_button]:py-[10px] [&_button.selected]:py-2 max-sm:[&_button.selected]:py-[9px]
            [&_button]:px-3 max-xs:[&_button]:px-2 xs:max-sm:[&_button]:px-[11px] [&_button.selected]:px-[11px]
            max-xs:[&_button.selected]:px-[7px] xs:max-sm:[&_button.selected]:px-[10px]`} aria-label="Фильтр персонажей">
          {filters.map(({ value, label }) => (
            <button
              key={value}
              className={`${filter === value ? " selected" : ""}`}
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
        <div className={`pet-grid grid [grid-template-columns:repeat(3,_minmax(0,_1fr))] gap-[17px]
            max-lg:[grid-template-columns:repeat(2,_minmax(0,_1fr))] max-md:gap-3 xl:gap-5`}>
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
        <div className={`collection-empty min-h-75 flex flex-col items-center justify-center text-center rounded-[13px] bg-white
            text-[#b58ba5] [&_h2]:mt-[17px] [&_h2]:text-[17px] [&_h2]:font-[550] [&_h2]:text-[#63556e] [&_p]:mt-3
            [&_p]:text-[#95869f] [&_p]:text-[11px] [&_p]:leading-[1.9] [&_>_button]:mt-5 [&_>_button]:min-h-11
            [&_>_button]:rounded-[7px] [&_>_button]:bg-[#f0eaf8] [&_>_button]:text-[#81679c] [&_>_button]:text-[11px]
            border border-solid border-[#e8e3ee] py-[35px] [&_>_button]:py-[10px] px-5 [&_>_button]:px-4`} role="status">
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
      <div className={`collection-footer flex items-center justify-between gap-[15px] text-[9px] text-[#82788d] mt-[22px]
            max-sm:text-[8px] max-sm:mt-[17px] [&_>_span:first-child]:flex [&_>_span:first-child]:items-center
            [&_>_span:first-child]:gap-[7px] max-xs:[&_>_span:first-child]:max-w-[145px]
            max-md:[&_>_span:first-child]:leading-[1.7] xs:max-sm:[&_>_span:first-child]:max-w-[205px]
            sm:max-md:[&_>_span:first-child]:max-w-[150px] [&_.tiny-pixel]:w-1 [&_.tiny-pixel]:h-1
            [&_.tiny-pixel]:bg-[#c8bfd6] max-md:[&_>_span:last-child]:whitespace-nowrap`}>
        <span>
          <span className="tiny-pixel w-[6px] h-[6px] inline-block bg-[#b1a3cc] shrink-[0]" />
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
