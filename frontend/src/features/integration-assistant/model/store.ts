import { create } from "zustand";
import { answerInstallationQuestion } from "./answer";
import type { GuideTopicId } from "@/shared/config";

export type GuideMessage = { id: string; role: "user" | "assistant"; text: string; topics: GuideTopicId[] };
type GuideState = {
  messages: GuideMessage[]; draft: string; openSignal: number;
  setDraft: (draft: string) => void;
  send: (text?: string) => GuideMessage | undefined;
  ask: (text: string) => void;
  startOver: () => void;
};
let messageSequence = 0;

export const useIntegrationAssistant = create<GuideState>()((set, get) => ({
  messages: [], draft: "", openSignal: 0,
  setDraft: (draft) => set({ draft }),
  send(text) {
    const value = (text ?? get().draft).trim().slice(0, 2000);
    if (!value) return undefined;
    const previous = get().messages.filter((message) => message.role === "assistant" && message.topics.length).at(-1)?.topics;
    const answer = answerInstallationQuestion(value, previous);
    const id = "guide-" + ++messageSequence;
    const reply: GuideMessage = { id, role: "assistant", ...answer };
    set((state) => ({ draft: text === undefined ? "" : state.draft, messages: [...state.messages,
      { id: `${id}-user`, role: "user", text: value, topics: [] }, reply] }));
    return reply;
  },
  ask(text) {
    set((state) => ({ openSignal: state.openSignal + 1 }));
    get().send(text);
  },
  startOver: () => set({ messages: [], draft: "" }),
}));
