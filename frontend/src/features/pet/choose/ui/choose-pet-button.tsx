import { ArrowRight, Check } from "lucide-react";
import { usePetPreferences } from "@/entities/pet";
import type { Pet } from "@/entities/pet";
export function ChoosePetButton({ pet }: { pet: Pet }) {
  const { chosenPet, choosePet } = usePetPreferences();
  return (
    <button
      className={`primary-button adopt-button flex items-center justify-between gap-[10px] bg-[#8067b6] text-white text-[11px]
            font-[450] min-h-[42px] rounded-[7px] [transition:background_0.18s,_transform_0.18s] [&:hover]:bg-[#6c54a0]
            [&:active]:[transform:translateY(1px)] w-full max-xs:text-[11px] max-sm:min-h-11 max-sm:gap-1
            xs:max-sm:text-[9px] max-sm:[&_svg]:w-[14px] max-sm:p-[10px] py-3 px-5`}
      onClick={() => choosePet(pet)}
    >
      {chosenPet?.id === pet.id ? (
        <>
          <Check size={17} />
          Мой бадди
        </>
      ) : (
        <>
          Выбрать бадди
          <ArrowRight size={17} />
        </>
      )}
    </button>
  );
}
