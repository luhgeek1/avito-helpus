import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { create } from "zustand";
import { orbiFetch, refreshSession } from "./http";
import { orbiKeys } from "./queries";
import { useSession } from "./session";
import { readSse } from "./sse";

export type OrbiNotice = { id: string; title: string; body: string; link: string | null };

/** The latest live notification; the companion reads it and says it out loud. */
export const useOrbiNotice = create<{ notice: OrbiNotice | null; show: (notice: OrbiNotice | null) => void }>()((set) => ({
  notice: null,
  show: (notice) => set({ notice }),
}));

const INVALIDATES: Record<string, readonly (readonly string[])[]> = {
  "notification.created": [orbiKeys.notifications],
  "request.updated": [orbiKeys.requests, orbiKeys.plan, orbiKeys.equipment],
  "plan.updated": [orbiKeys.plan, orbiKeys.mentees],
  "escalation.updated": [["orbi", "escalations"], orbiKeys.mentees],
};

export function parseNotice(data: string): OrbiNotice | null {
  try {
    const value = JSON.parse(data) as Partial<OrbiNotice>;
    if (typeof value.id !== "string" || typeof value.title !== "string") return null;
    return { id: value.id, title: value.title, body: typeof value.body === "string" ? value.body : "", link: value.link ?? null };
  } catch {
    return null;
  }
}

const ALL_KEYS = [...new Map(Object.values(INVALIDATES).flat().map((key) => [key.join("/"), key])).values()];

/**
 * Keeps one SSE connection to /events while signed in and reconnects with a growing pause.
 * The server closes the stream with `auth.required` once the access token expires; then we refresh
 * right away, reconnect and refetch everything an event might have changed in between.
 */
export function useOrbiRealtime() {
  const client = useQueryClient();
  const authed = useSession((state) => state.status === "authenticated");
  const epoch = useSession((state) => state.epoch);
  useEffect(() => {
    if (!authed) return;
    const controller = new AbortController();
    let attempt = 0;
    void (async () => {
      while (!controller.signal.aborted) {
        try {
          const response = await orbiFetch("/events", { signal: controller.signal, headers: { Accept: "text/event-stream" } });
          if (!response.body) return;
          attempt = 0;
          let reauth = false;
          for await (const { event, data } of readSse(response.body, controller.signal)) {
            if (event === "auth.required") { reauth = true; break; }
            for (const key of INVALIDATES[event] ?? []) void client.invalidateQueries({ queryKey: key });
            if (event === "notification.created") {
              const notice = parseNotice(data);
              if (notice) useOrbiNotice.getState().show(notice);
            }
          }
          if (reauth) {
            if (!(await refreshSession())) return;
            for (const key of ALL_KEYS) void client.invalidateQueries({ queryKey: key });
            continue;
          }
        } catch {
          if (controller.signal.aborted) return;
        }
        attempt += 1;
        await new Promise((resolve) => setTimeout(resolve, Math.min(30_000, 1000 * 2 ** attempt)));
      }
    })();
    return () => controller.abort();
  }, [authed, epoch, client]);
}
