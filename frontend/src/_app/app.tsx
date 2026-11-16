"use client";

import { Suspense } from "react";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { WorkspaceShell } from "@/widgets/workspace-shell";
import { useRoute } from "./router/use-route";
import { PortalShell } from "@/widgets/portal-shell";
import { PortalProvider } from "./model/portal-provider";
import { OrbiCompanion } from "./companion";
import { ExperienceBar } from "@/shared/ui/experience-switcher";
import { DemoResetButton } from "@/features/demo-reset";

function AppContent({ children }: { children: ReactNode }) {
  const { page, navigate } = useRoute();
  const pathname = usePathname();
  if (pathname === "/") return children;
  return (
    <>
      <div className="border-b border-line bg-canvas">
        <ExperienceBar demo actions={<DemoResetButton />}>
          <span className="text-12 font-medium text-[#646777]">Орби <span className="hidden font-normal sm:inline">/ демо на портале «Хаб»</span></span>
        </ExperienceBar>
      </div>
      {page === "pets" ? <WorkspaceShell page={page} navigate={navigate} companion={null}>{children}</WorkspaceShell>
          : <Suspense fallback={<div className="min-h-screen bg-white" />}><PortalProvider><PortalShell>{children}</PortalShell></PortalProvider></Suspense>}
    </>
  );
}

export function App({ children }: { children: ReactNode }) {
  const guideMode = usePathname() === "/";
  return (
    <OrbiCompanion guideMode={guideMode}><AppContent>{children}</AppContent></OrbiCompanion>
  );
}
