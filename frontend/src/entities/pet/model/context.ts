import { createContext } from "react";
import type { Pet } from "./types";
export interface PetPreferences {
  chosenPet: Pet | undefined;
  favoriteIds: string[];
  toggleFavorite: (petId: string) => void;
  paused: boolean;
  selectionVersion: number;
  choosePet: (pet: Pet) => void;
  setPaused: (paused: boolean) => void;
}
export const PetPreferencesContext = createContext<PetPreferences | null>(null);
