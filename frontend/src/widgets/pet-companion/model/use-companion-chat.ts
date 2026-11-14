import { useCallback } from "react";
import { useOrbiChat } from "@/features/orbi-chat";
import type { OrbiMessage } from "@/features/orbi-chat";
import { useSession } from "@/shared/api";

/** The companion's view of the Orbi conversation: real agent behind a session. */
export function useCompanionChat() {
  const status = useSession((state) => state.status);
  const draft = useOrbiChat((state) => state.draft);
  const setDraft = useOrbiChat((state) => state.setDraft);
  const busy = useOrbiChat((state) => state.busy);
  const messages = useOrbiChat((state) => state.messages);
  const load = useOrbiChat((state) => state.load);
  const sendMessage = useOrbiChat((state) => state.send);
  const authenticated = status === "authenticated";
  const send = useCallback((): Promise<OrbiMessage | undefined> => {
    if (!authenticated) return Promise.resolve(undefined);
    return sendMessage();
  }, [authenticated, sendMessage]);
  return { messages, draft, setDraft, send, load, busy, authenticated, status, ready: authenticated && !busy };
}

export type CompanionChatModel = ReturnType<typeof useCompanionChat>;
