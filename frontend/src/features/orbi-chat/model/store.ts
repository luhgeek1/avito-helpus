import { create } from "zustand";
import { conversationSchema, historySchema, OrbiError, orbiFetch, orbiJson, readUiStream } from "@/shared/api";
import { z } from "zod";
import { applyChunk, fromHistory } from "./message";
import type { ActionStatus, OrbiMessage } from "./message";

type Decision = "approve" | "reject";

type ChatState = {
  conversationId: string | null;
  messages: OrbiMessage[];
  loaded: boolean;
  busy: boolean;
  draft: string;
  /** Incremented to ask the companion to open its chat window (from "Сделать с Орби"). */
  openSignal: number;
  setDraft: (draft: string) => void;
  load: () => Promise<void>;
  send: (text?: string) => Promise<OrbiMessage | undefined>;
  decide: (actionId: string, decision: Decision, edits?: Record<string, string>) => Promise<OrbiMessage | undefined>;
  rate: (messageId: string, rating: "up" | "down") => Promise<void>;
  /** Opens the companion chat and sends a prepared phrase. */
  ask: (text: string) => void;
  startOver: () => void;
  clear: () => void;
};

const now = () => new Date().toISOString();
const localId = () => `local-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;

let controller: AbortController | null = null;

export const useOrbiChat = create<ChatState>()((set, get) => {
  function patchLast(update: (message: OrbiMessage) => OrbiMessage) {
    set((state) => {
      const messages = state.messages.slice();
      const last = messages.at(-1);
      if (last?.role === "assistant") messages[messages.length - 1] = update(last);
      return { messages };
    });
  }

  async function stream(path: string, json: unknown): Promise<OrbiMessage | undefined> {
    controller?.abort();
    controller = new AbortController();
    const placeholder: OrbiMessage = { id: localId(), role: "assistant", parts: [], createdAt: now(), streaming: true, status: "Думаю…" };
    set((state) => ({ busy: true, messages: [...state.messages, placeholder] }));
    try {
      const response = await orbiFetch(path, { method: "POST", json, signal: controller.signal, headers: { Accept: "text/event-stream" } });
      if (!response.body) throw new OrbiError(response.status, "EMPTY_STREAM", "Пустой ответ");
      for await (const chunk of readUiStream(response.body, controller.signal)) patchLast((message) => applyChunk(message, chunk));
      patchLast((message) => ({ ...message, streaming: false, status: undefined }));
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return undefined;
      const text = error instanceof OrbiError && error.code === "ACTION_EXPIRED"
        ? "Карточка устарела. Напиши запрос ещё раз — подготовлю новую."
        : error instanceof OrbiError && error.status === 429 ? "Слишком много сообщений подряд. Подожди немного."
          : "Орби сейчас не может ответить. Попробуй ещё раз через минуту.";
      patchLast((message) => ({ ...message, streaming: false, status: undefined, error: text }));
    } finally {
      set({ busy: false });
    }
    return get().messages.at(-1);
  }

  async function ensureConversation(): Promise<string> {
    const existing = get().conversationId;
    if (existing) return existing;
    const conversation = await orbiJson("/chat/conversations", conversationSchema, { method: "POST" });
    set({ conversationId: conversation.id });
    return conversation.id;
  }

  return {
    conversationId: null, messages: [], loaded: false, busy: false, draft: "", openSignal: 0,
    setDraft: (draft) => set({ draft }),
    async load() {
      if (get().loaded || get().conversationId) return;
      set({ loaded: true });
      try {
        const conversations = await orbiJson("/chat/conversations", z.array(conversationSchema));
        const latest = conversations[0];
        if (!latest) return;
        const history = await orbiJson(`/chat/conversations/${latest.id}`, historySchema);
        if (!get().conversationId) set({ conversationId: latest.id, messages: history.messages.map(fromHistory) });
      } catch {
        set({ loaded: false });
      }
    },
    async send(text) {
      const value = (text ?? get().draft).trim();
      if (!value || get().busy) return undefined;
      set((state) => ({
        busy: true,
        draft: text === undefined ? "" : state.draft,
        messages: [...state.messages, { id: localId(), role: "user", parts: [{ type: "text", id: "t", text: value }], createdAt: now() }],
      }));
      let id: string;
      try {
        id = await ensureConversation();
      } catch {
        set((state) => ({ busy: false, messages: [...state.messages, {
          id: localId(), role: "assistant", parts: [], createdAt: now(), error: "Нет связи с Орби. Проверь, что ты вошёл, и попробуй ещё раз.",
        }] }));
        return get().messages.at(-1);
      }
      return stream(`/chat/conversations/${id}/messages`, { text: value });
    },
    async decide(actionId, decision, edits = {}) {
      const id = get().conversationId;
      if (!id || get().busy) return undefined;
      const status: ActionStatus = decision === "approve" ? "approved" : "rejected";
      set((state) => ({
        busy: true,
        messages: state.messages.map((message) => ({
          ...message,
          parts: message.parts.map((part) => (part.type === "action" && part.data.id === actionId ? { ...part, data: { ...part.data, status } } : part)),
        })),
      }));
      return stream(`/chat/conversations/${id}/actions/${actionId}`, { decision, edits });
    },
    async rate(messageId, rating) {
      set((state) => ({ messages: state.messages.map((message) => (message.id === messageId ? { ...message, feedback: rating } : message)) }));
      try {
        await orbiFetch(`/chat/messages/${messageId}/feedback`, { method: "POST", json: { rating } });
      } catch {
        // Feedback is best effort; the thumbs stay highlighted locally.
      }
    },
    ask(text) {
      set((state) => ({ openSignal: state.openSignal + 1 }));
      void get().send(text);
    },
    startOver() {
      controller?.abort();
      set({ conversationId: null, messages: [], busy: false, draft: "" });
    },
    clear() {
      controller?.abort();
      set({ conversationId: null, messages: [], loaded: false, busy: false, draft: "", openSignal: 0 });
    },
  };
});
