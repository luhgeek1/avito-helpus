import { defaultPet, pets } from "@/entities/pet";

export const wardrobePets = [
  defaultPet,
  ...pets.filter((pet) => pet.category === "orbi"),
  ...pets.filter((pet) => pet.category !== "orbi" && pet.id !== defaultPet.id),
];
export const wardrobeIndex = (index: number) =>
  ((index % wardrobePets.length) + wardrobePets.length) % wardrobePets.length;
