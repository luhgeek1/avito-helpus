import { useEffect, useRef, useState } from "react";
import type { CSSProperties, RefObject } from "react";
import { usePetPreferences } from "@/entities/pet";
import { wardrobePets, wardrobeIndex } from "../model/wardrobe-catalog";
import { useWardrobeCarousel } from "../model/use-wardrobe-carousel";
import { useWardrobeGesture } from "../model/use-wardrobe-gesture";
import { useWardrobePlacement } from "../model/use-wardrobe-placement";
import { useRadialTransition } from "../model/use-radial-transition";
import { WardrobePetOption } from "./wardrobe-pet-option";

export function CompanionWardrobe({ anchor, position, open, semicircle = false }: {
  anchor: RefObject<HTMLDivElement | null>; position: CSSProperties; open: boolean; semicircle?: boolean;
}) {
  const { chosenPet, choosePet, paused } = usePetPreferences();
  const initialIndex = Math.max(0, wardrobePets.findIndex((pet) => pet.id === chosenPet?.id));
  const { cursor, move } = useWardrobeCarousel(anchor, open, initialIndex);
  const layout = useWardrobePlacement(anchor, position, semicircle);
  const gesture = useWardrobeGesture(move);
  const root = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);
  const { interactive, onTransitionEnd } = useRadialTransition(open);
  useEffect(() => {
    if (!open) { setRevealed(false); return; }
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { setRevealed(true); return; }
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setRevealed(true));
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);
  useEffect(() => {
    if (open && interactive) root.current?.focus({ preventScroll: true });
  }, [open, interactive]);
  return (
    <div ref={root} id="companion-wardrobe" role="region" aria-roledescription="карусель" aria-label="Гардероб спутника"
      aria-hidden={!open} inert={!open || !interactive} tabIndex={-1}
      className="pointer-events-none fixed inset-0 z-37 touch-none outline-none"
      {...gesture.handlers}
      onKeyDown={(event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        move(event.key === "ArrowLeft" ? -1 : 1);
      }}>
      {layout && Array.from({ length: semicircle ? 9 : 7 }, (_, i) => i - (semicircle ? 4 : 3)).map((offset) => {
        const logical = Math.round(cursor) + offset;
        const pet = wardrobePets[wardrobeIndex(logical)];
        return <WardrobePetOption key={logical} pet={pet} layout={layout} offset={logical - cursor} slot={offset}
          revealed={revealed} interactive={interactive && open} chosen={chosenPet?.id === pet.id} paused={paused}
          onTransitionEnd={offset === 0 ? onTransitionEnd : undefined}
          onChoose={(keyboard) => { if (keyboard || !gesture.consumeSwipe()) choosePet(pet); }} />;
      })}
      <span className="sr-only" role="status" aria-live="polite">
        {wardrobeIndex(Math.round(cursor)) + 1} из {wardrobePets.length}: {wardrobePets[wardrobeIndex(Math.round(cursor))].name}
      </span>
    </div>
  );
}
