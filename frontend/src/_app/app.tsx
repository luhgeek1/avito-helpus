"use client";

import { Suspense } from "react";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { WorkspaceShell } from "@/widgets/workspace-shell";
import { useRoute } from "./router/use-route";
import { PortalShell } from "@/widgets/portal-shell";
import { PortalProvider } from "./model/portal-provider";
import { OrbiCompanion } from "./companion";
import { ExperienceSwitcher } from "@/shared/ui/experience-switcher";

function AppContent({ children }: { children: ReactNode }) {
  const { page, navigate } = useRoute();
  const pathname = usePathname();
  if (pathname === "/") return children;
  return (
    <>
      <div className="flex min-h-16 items-center justify-between gap-3 border-b border-line bg-canvas px-4 sm:px-8">
        <span className="text-12 font-medium text-[#646777]">Орби <span className="hidden font-normal sm:inline">/ демо на портале «Хаб»</span></span>
        <ExperienceSwitcher demo />
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
