import { pets } from "../config/pets";
import type { Pet } from "../model/types";
const STORAGE_KEY = "buddy-pet";
export function readChosenPet(): string | null {
  try {
    const id = localStorage.getItem(STORAGE_KEY);
    return pets.some((pet) => pet.id === id) ? id : null;
  } catch {
    return null;
  }
}
export function saveChosenPet(pet: Pet): void {
  try {
    localStorage.setItem(STORAGE_KEY, pet.id);
  } catch {
    /* The current session can still keep the selection in memory. */
  }
}

const FAVORITES_KEY = "buddy-favorites";
export function readFavoritePetIds(): string[] {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem(FAVORITES_KEY) ?? "[]",
    );
    if (!Array.isArray(value)) return [];
    const validIds = new Set(pets.map((pet) => pet.id));
    return [
      ...new Set(
        value.filter(
          (id): id is string => typeof id === "string" && validIds.has(id),
        ),
      ),
    ];
  } catch {
    return [];
  }
}
export function saveFavoritePetIds(ids: string[]): void {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids));
  } catch {
    /* Favorites remain available in memory when storage is blocked. */
  }
}
