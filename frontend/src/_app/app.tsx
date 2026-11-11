"use client";

import { Suspense } from "react";
import type { ReactNode } from "react";
import { PetPreferencesProvider } from "@/entities/pet";
import { PetCompanion } from "@/widgets/pet-companion";
import { WorkspaceShell } from "@/widgets/workspace-shell";
import { useRoute } from "./router/use-route";
import { PortalShell } from "@/widgets/portal-shell";
import { PortalProvider } from "./model/portal-provider";

export function App({ children }: { children: ReactNode }) {
  const { page, navigate } = useRoute();
  return (
    <PetPreferencesProvider>
      {page === "pets" ? <WorkspaceShell page={page} navigate={navigate} companion={null}>{children}</WorkspaceShell>
          : <Suspense fallback={<div className="min-h-screen bg-white" />}><PortalProvider><PortalShell>{children}</PortalShell></PortalProvider></Suspense>}
      <PetCompanion />
    </PetPreferencesProvider>
  );
}
