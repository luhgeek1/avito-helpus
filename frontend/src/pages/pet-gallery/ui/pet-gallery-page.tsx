import { useState } from "react";
import { pets, defaultPet, usePetPreferences } from "@/entities/pet";
import type { Pet } from "@/entities/pet";
import { PetCollection } from "@/widgets/pet-collection";
import { PetInspector } from "@/widgets/pet-inspector";
const orbiCount = pets.filter((pet) => pet.category === "orbi").length;

export function PetGalleryPage() {
  const { chosenPet } = usePetPreferences();
  const [active, setActive] = useState(() => {
    const requestedId = new URLSearchParams(location.search).get("pet");
    return (
      pets.find((pet) => pet.id === requestedId) ?? chosenPet ?? defaultPet
    );
  });
  function select(pet: Pet) {
