"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { defaultPet, pets, usePetPreferences } from "@/entities/pet";

const key = "buddy-onboarding-v1";
const Context = createContext({ active: true, ready: false, start() {}, finish() {} });

export function PetOnboardingProvider({ children, autoStart = true }: { children: ReactNode; autoStart?: boolean }) {
  const [active, setActive] = useState(autoStart);
  const [ready, setReady] = useState(false);
  const { choosePet } = usePetPreferences();
  useEffect(() => {
    let completed = false;
    try {
      completed = localStorage.getItem(key) === "done";
      if (!pets.some(pet => pet.id === localStorage.getItem("buddy-pet"))) choosePet(defaultPet);
    } catch {
      // A blocked storage still allows completing the tour for this session.
      choosePet(defaultPet);
    }
    setActive(!completed && autoStart);
    setReady(true);
  }, [choosePet, autoStart]);
  function finish() {
    try { localStorage.setItem(key, "done"); } catch { /* Keep the in-memory completion. */ }
    setActive(false);
  }
  return <Context.Provider value={{ active, ready, finish, start: () => setActive(true) }}>{children}</Context.Provider>;
}

export function usePetOnboarding() { return useContext(Context); }
