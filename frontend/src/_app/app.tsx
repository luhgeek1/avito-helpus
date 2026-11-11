"use client";

import type { ReactNode } from "react";
import { PetPreferencesProvider } from "@/entities/pet";
import { PetCompanion } from "@/widgets/pet-companion";
import { WorkspaceShell } from "@/widgets/workspace-shell";
import { useRoute } from "./router/use-route";

export function App({ children }: { children: ReactNode }) {
  const { page, navigate } = useRoute();
  return (
    <PetPreferencesProvider>
      <WorkspaceShell page={page} navigate={navigate} companion={<PetCompanion />}>
        {children}
      </WorkspaceShell>
    </PetPreferencesProvider>
  );
}
