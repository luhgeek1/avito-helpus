import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { pets } from "../config/pets";
import {
  readChosenPet,
  saveChosenPet,
  readFavoritePetIds,
  saveFavoritePetIds,
} from "../lib/pet-storage";
import { PetPreferencesContext } from "./context";
import type { Pet } from "./types";
export function PetPreferencesProvider({ children }: { children: ReactNode }) {
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setChosenId(readChosenPet());
    setFavoriteIds(readFavoritePetIds());
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (hydrated) saveFavoritePetIds(favoriteIds);
  }, [favoriteIds, hydrated]);
  const toggleFavorite = useCallback((id: string) => {
    setFavoriteIds((ids) =>
      ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id],
    );
  }, []);
  const [paused, setPaused] = useState(false);
  const [selectionVersion, setSelectionVersion] = useState(0);
  const choosePet = useCallback((pet: Pet) => {
    setChosenId(pet.id);
    setSelectionVersion((version) => version + 1);
    saveChosenPet(pet);
  }, []);
  const value = useMemo(
    () => ({
      chosenPet: pets.find((pet) => pet.id === chosenId),
      favoriteIds,
      toggleFavorite,
      paused,
      selectionVersion,
      choosePet,
      setPaused,
    }),
    [
      chosenId,
      favoriteIds,
      toggleFavorite,
      paused,
      selectionVersion,
      choosePet,
    ],
  );
  return (
    <PetPreferencesContext.Provider value={value}>
      {children}
    </PetPreferencesContext.Provider>
  );
}
