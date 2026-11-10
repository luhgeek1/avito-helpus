import { ArrowRight, Check } from "lucide-react";
import { usePetPreferences } from "@/entities/pet";
import type { Pet } from "@/entities/pet";
export function ChoosePetButton({ pet }: { pet: Pet }) {
  const { chosenPet, choosePet } = usePetPreferences();
  return (
    <button
      className="primary-button adopt-button"
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
