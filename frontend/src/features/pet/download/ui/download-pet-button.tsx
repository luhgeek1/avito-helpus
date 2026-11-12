import { ArrowDownToLine } from "lucide-react";
import type { Pet } from "@/entities/pet";
import { downloadSprite } from "../lib/download-sprite";
export function DownloadPetButton({ pet, className }: { pet: Pet; className?: string }) {
  return (
    <button
      className={className}
      onClick={() => downloadSprite(pet)}
      aria-label={`Скачать спрайт: ${pet.name}`}
      title="Скачать SVG"
    >
      <ArrowDownToLine size={17} className="max-sm:w-3.25" />
    </button>
  );
}
