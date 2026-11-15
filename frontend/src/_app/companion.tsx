"use client";

import type { ReactNode } from "react";
import { PetPreferencesProvider } from "@/entities/pet";
import { PetOnboardingProvider, usePetOnboarding } from "@/features/pet/onboarding";
import { PetCompanion } from "@/widgets/pet-companion";
import { AppQueryProvider } from "./model/portal-provider";

function CompanionContent({ children, guideMode }: { children?: ReactNode; guideMode: boolean }) {
  const { active } = usePetOnboarding();
  return <>
    <div className="contents" inert={active}>{children}</div>
    <PetCompanion guideMode={guideMode} />
  </>;
}

/** Mount once in a persistent Next.js layout; no portal shell or portal mocks required. */
export function OrbiCompanion({ children, guideMode = false }: { children?: ReactNode; guideMode?: boolean }) {
  return <AppQueryProvider><PetPreferencesProvider><PetOnboardingProvider autoStart={!guideMode}>
    <CompanionContent guideMode={guideMode}>{children}</CompanionContent>
  </PetOnboardingProvider></PetPreferencesProvider></AppQueryProvider>;
}
