import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PetPreferencesProvider } from "@/entities/pet";
import { PetOnboardingProvider } from "@/features/pet/onboarding";
import { PetCompanion } from "@/widgets/pet-companion";
import { useOrbiChat } from "@/features/orbi-chat";
import { orbiKeys, useOrbiNotice, useOrbiRealtime } from "@/shared/api";
import { onAccountChange, useSession, watchSession } from "./session";
import { LoginDialog } from "./login-dialog";
import type { OrbiCompanionProps } from "./types";

function Session({ client }: { client: QueryClient }) {
  useOrbiRealtime();
  useEffect(() => {
    const stop = onAccountChange(() => {
      useOrbiChat.getState().clear(); useOrbiNotice.getState().show(null);
      void client.cancelQueries(); client.clear();
    });
    const unwatch = watchSession();
    void useSession.getState().boot();
    const unsubscribe = useOrbiChat.subscribe((state, previous) => {
      if (previous.busy && !state.busy) void client.invalidateQueries({ queryKey: orbiKeys.all });
    });
    return () => { stop(); unwatch(); unsubscribe(); void client.cancelQueries(); client.clear(); };
  }, [client]);
  return null;
}

export function Content({ mode, autoStartTour = false }: OrbiCompanionProps) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } }));
  return <QueryClientProvider client={client}>
    {mode !== "guide" && <Session client={client} />}
    <PetPreferencesProvider><PetOnboardingProvider autoStart={autoStartTour}>
      <div className="orbi-surface font-sans text-14 leading-normal text-ink"><PetCompanion guideMode={mode === "guide"} /><LoginDialog /></div>
    </PetOnboardingProvider></PetPreferencesProvider>
  </QueryClientProvider>;
}
