import { useCallback, useMemo } from "react";
import { useOrbiChat } from "@/features/orbi-chat";
import type { OrbiMessage } from "@/features/orbi-chat";
import { useSession } from "@/shared/api";
import { useIntegrationAssistant } from "@/features/integration-assistant";
import type { GuideMessage } from "@/features/integration-assistant";

const guideMessage = (message: GuideMessage): OrbiMessage => ({
  id: message.id, role: message.role, parts: [{ type: "text", id: "guide", text: message.text }], createdAt: "",
});
const loadGuide = async () => {};

/** The companion's view of the Orbi conversation: real agent behind a session. */
export function useCompanionChat(guideMode = false) {
  const status = useSession((state) => state.status);
  const draft = useOrbiChat((state) => state.draft);
  const setDraft = useOrbiChat((state) => state.setDraft);
  const busy = useOrbiChat((state) => state.busy);
  const messages = useOrbiChat((state) => state.messages);
  const load = useOrbiChat((state) => state.load);
  const sendMessage = useOrbiChat((state) => state.send);
  const startOver = useOrbiChat((state) => state.startOver);
  const openSignal = useOrbiChat((state) => state.openSignal);
  const guide = useIntegrationAssistant();
  const guideMessages = useMemo(() => guide.messages.map(guideMessage), [guide.messages]);
  const authenticated = status === "authenticated";
  const send = useCallback((): Promise<OrbiMessage | undefined> => {
    if (!authenticated) return Promise.resolve(undefined);
    return sendMessage();
  }, [authenticated, sendMessage]);
  const sendGuide = useCallback(async () => {
    const result = guide.send();
    return result ? guideMessage(result) : undefined;
  }, [guide.send]);
  return guideMode
    ? { kind: "guide" as const, messages: guideMessages, draft: guide.draft, setDraft: guide.setDraft,
      send: sendGuide, load: loadGuide, busy: false, authenticated: true, status, ready: true, startOver: guide.startOver, openSignal: guide.openSignal }
    : { kind: "workspace" as const, messages, draft, setDraft, send, load, busy, authenticated, status, ready: authenticated && !busy, startOver, openSignal };
}

export type CompanionChatModel = ReturnType<typeof useCompanionChat>;
