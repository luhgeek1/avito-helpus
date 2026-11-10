import { ArrowDownToLine } from "lucide-react";
import type { Pet } from "@/entities/pet";
import { downloadSprite } from "../lib/download-sprite";
export function DownloadPetButton({ pet }: { pet: Pet }) {
  return (
    <button
      onClick={() => downloadSprite(pet)}
      aria-label={`Скачать спрайт: ${pet.name}`}
      title="Скачать SVG"
    >
      <ArrowDownToLine size={17} />
    </button>
  );
}
