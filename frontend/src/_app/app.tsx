"use client";

import { Suspense } from "react";
import type { ReactNode } from "react";
import { PetPreferencesProvider } from "@/entities/pet";
import { PetCompanion } from "@/widgets/pet-companion";
import { WorkspaceShell } from "@/widgets/workspace-shell";
import { useRoute } from "./router/use-route";
import { PortalShell } from "@/widgets/portal-shell";
import { AppQueryProvider, PortalProvider } from "./model/portal-provider";
import { PetOnboardingProvider, usePetOnboarding } from "@/features/pet/onboarding";

function AppContent({ children }: { children: ReactNode }) {
  const { page, navigate } = useRoute();
  const { active } = usePetOnboarding();
  return (
    <>
      <div className="contents" inert={active}>
      {page === "pets" ? <WorkspaceShell page={page} navigate={navigate} companion={null}>{children}</WorkspaceShell>
          : <Suspense fallback={<div className="min-h-screen bg-white" />}><PortalProvider><PortalShell>{children}</PortalShell></PortalProvider></Suspense>}
      </div>
      <PetCompanion />
    </>
  );
}

export function App({ children }: { children: ReactNode }) {
  return (
    <AppQueryProvider>
      <PetPreferencesProvider><PetOnboardingProvider><AppContent>{children}</AppContent></PetOnboardingProvider></PetPreferencesProvider>
    </AppQueryProvider>
  );
}
