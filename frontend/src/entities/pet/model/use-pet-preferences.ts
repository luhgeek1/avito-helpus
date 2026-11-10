import { useContext } from "react";
import { PetPreferencesContext } from "./context";
export function usePetPreferences() {
  const context = useContext(PetPreferencesContext);
  if (!context) throw new Error("PetPreferencesProvider is required.");
  return context;
}
