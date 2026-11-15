import { useOrbiChat } from "@/features/orbi-chat";
import { useIntegrationAssistant } from "@/features/integration-assistant";
import { runtime } from "./runtime";
import { useSession } from "./session";
import type { OrbiHandle } from "./types";

export const controls: OrbiHandle = {
  openChat() {
    if (runtime().props.mode === "guide") useIntegrationAssistant.setState((state) => ({ openSignal: state.openSignal + 1 }));
    else useOrbiChat.setState((state) => ({ openSignal: state.openSignal + 1 }));
  },
  ask(text) {
    if (!text.trim()) return;
    if (runtime().props.mode === "guide") useIntegrationAssistant.getState().ask(text);
    else if (useSession.getState().status === "authenticated") useOrbiChat.getState().ask(text);
    else { controls.openChat(); runtime().props.onError?.(new Error("Sign in before asking Orbi")); }
  },
  startOver() {
    if (runtime().props.mode === "guide") useIntegrationAssistant.getState().startOver();
    else useOrbiChat.getState().startOver();
  },
  async refreshSession() {
    const value = runtime();
    if (value.props.mode === "guide") return;
    await useSession.getState().boot();
  },
};
