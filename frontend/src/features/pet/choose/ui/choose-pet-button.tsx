import { ArrowRight, Check } from "lucide-react";
import { usePetPreferences } from "@/entities/pet";
import type { Pet } from "@/entities/pet";
export function ChoosePetButton({ pet }: { pet: Pet }) {
  const { chosenPet, choosePet } = usePetPreferences();
  return (
    <button
      className="flex min-h-10.5 w-full items-center justify-between gap-2.5 rounded-[7px] bg-[#8067b6] px-5 py-3 text-11
            font-[450] text-white transition-[background,translate] duration-180 hover:bg-[#6c54a0] active:translate-y-px
            max-sm:min-h-11 max-sm:gap-1 max-sm:p-2.5 max-xs:text-11 xs:max-sm:text-9"
      onClick={() => choosePet(pet)}
    >
      {chosenPet?.id === pet.id ? (
        <>
          <Check size={17} className="max-sm:w-3.5" />
          Мой бадди
        </>
      ) : (
        <>
          Выбрать бадди
          <ArrowRight size={17} className="max-sm:w-3.5" />
        </>
      )}
    </button>
  );
}
