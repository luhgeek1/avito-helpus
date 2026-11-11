import { useEffect, useRef, useState } from "react";
import type { CSSProperties, RefObject } from "react";
import { usePetPreferences } from "@/entities/pet";
import { wardrobePets, wardrobeIndex } from "../model/wardrobe-catalog";
import { useWardrobeCarousel } from "../model/use-wardrobe-carousel";
import { useWardrobeGesture } from "../model/use-wardrobe-gesture";
import { useWardrobePlacement } from "../model/use-wardrobe-placement";
import { WardrobePetOption } from "./wardrobe-pet-option";
import { WardrobeControls } from "./wardrobe-controls";

export function CompanionWardrobe({ anchor, position, open }: {
  anchor: RefObject<HTMLDivElement | null>; position: CSSProperties; open: boolean;
}) {
  const { chosenPet, choosePet, paused } = usePetPreferences();
  const initialIndex = Math.max(0, wardrobePets.findIndex((pet) => pet.id === chosenPet?.id));
  const { cursor, move } = useWardrobeCarousel(anchor, open, initialIndex);
  const layout = useWardrobePlacement(anchor, position);
  const gesture = useWardrobeGesture(move);
  const root = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);
  const [interactive, setInteractive] = useState(false);
  useEffect(() => {
    setInteractive(false);
    setRevealed(false);
    if (!open) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setRevealed(true));
    });
    const timer = setTimeout(() => {
      setInteractive(true);
      root.current?.querySelector<HTMLButtonElement>('[aria-label="Следующий персонаж"]')?.focus();
    }, reduced ? 50 : 380);
    return () => { cancelAnimationFrame(frame); clearTimeout(timer); };
  }, [open]);
  return (
    <div ref={root} id="companion-wardrobe" role="region" aria-roledescription="карусель" aria-label="Гардероб спутника"
      aria-hidden={!open} inert={!open || !interactive}
      className="companion-wardrobe pointer-events-none touch-none fixed inset-0 z-37 overflow-hidden [contain:paint]"
      {...gesture.handlers}
      onKeyDown={(event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        move(event.key === "ArrowLeft" ? -1 : 1);
      }}>
      {layout && Array.from({ length: 7 }, (_, i) => i - 3).map((offset) => {
        const logical = cursor + offset;
        const pet = wardrobePets[wardrobeIndex(logical)];
        return <WardrobePetOption key={logical} pet={pet} layout={layout} offset={offset}
          revealed={revealed} interactive={interactive && open} chosen={chosenPet?.id === pet.id} paused={!open || paused}
          onChoose={(keyboard) => { if (keyboard || !gesture.consumeSwipe()) choosePet(pet); }} />;
      })}
      {layout && revealed && <WardrobeControls layout={layout} move={move} />}
      <span className="sr-only" role="status" aria-live="polite">
        {wardrobeIndex(cursor) + 1} из {wardrobePets.length}: {wardrobePets[wardrobeIndex(cursor)].name}
      </span>
    </div>
  );
}
