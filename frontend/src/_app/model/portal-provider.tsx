import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { startPortalMocks } from "@/shared/api";

export function createPortalQueryClient() {
  return new QueryClient({ defaultOptions: { queries: {
    staleTime: 60_000, retry: process.env.NODE_ENV === "test" ? false : 1, refetchOnWindowFocus: false,
  } } });
}

export function PortalProvider({ children }: { children: ReactNode }) {
  const [client] = useState(createPortalQueryClient);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    void startPortalMocks().finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);
  if (!ready) return <div className="flex min-h-screen items-center justify-center bg-white font-portal text-15 leading-5 text-primary" role="status">Загружаем Хаб…</div>;
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
