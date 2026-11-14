import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useOrbiChat } from "@/features/orbi-chat";
import { onAccountChange, orbiKeys, startPortalMocks, useOrbiRealtime, useSession } from "@/shared/api";

export function createPortalQueryClient() {
  return new QueryClient({ defaultOptions: { queries: {
    staleTime: 60_000, retry: process.env.NODE_ENV === "test" ? false : 1, refetchOnWindowFocus: false,
  } } });
}

/** Restores the Orbi session, keeps the live event stream and forgets user data on sign-out. */
function OrbiSession() {
  const client = useQueryClient();
  useEffect(() => { void useSession.getState().boot(); }, []);
  useEffect(() => onAccountChange(() => {
    useOrbiChat.getState().clear();
    client.removeQueries({ queryKey: orbiKeys.all });
  }), [client]);
  // Agent tools change plans, requests and questions: refresh them when a turn ends.
  useEffect(() => useOrbiChat.subscribe((state, previous) => {
    if (previous.busy && !state.busy) void client.invalidateQueries({ queryKey: orbiKeys.all });
  }), [client]);
  useOrbiRealtime();
  return null;
}

/** One query client for the portal, the Orbi screens and the companion. */
export function AppQueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(createPortalQueryClient);
  return <QueryClientProvider client={client}><OrbiSession />{children}</QueryClientProvider>;
}

/** Decorative portal sections run on MSW mocks; the Orbi API (/api/v1) always goes to the backend. */
export function PortalProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    void startPortalMocks().finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);
  if (!ready) return <div className="flex min-h-screen items-center justify-center bg-white font-portal text-15 leading-5 text-primary" role="status">Загружаем Хаб…</div>;
  return children;
}
