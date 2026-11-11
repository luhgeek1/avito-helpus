import { useEffect, useState } from "react";
import { mockMessages, mockReply } from "./chat-messages";
import type { ChatMessage } from "./chat-messages";

const storageKey = "buddy-chat";
function isMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Partial<ChatMessage>;
  return typeof message.id === "string" && typeof message.text === "string" && typeof message.time === "string"
    && (message.role === "assistant" || message.role === "user");
}

export function useCompanionChat() {
  const [messages, setMessages] = useState<ChatMessage[]>(mockMessages);
  const [draft, setDraft] = useState("");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "null");
      if (Array.isArray(saved) && saved.length && saved.every(isMessage)) setMessages(saved);
    } catch {
      // Keep the demo conversation available when storage cannot be read.
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(storageKey, JSON.stringify(messages)); } catch {
      // The conversation still works in memory when storage is unavailable.
    }
  }, [messages, ready]);
  function send() {
    const text = draft.trim();
    if (!text || !ready) return;
    const time = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" }).format(new Date());
    const reply: ChatMessage = { id: crypto.randomUUID(), role: "assistant", text: mockReply(text), time };
    setMessages((current) => [...current,
      { id: crypto.randomUUID(), role: "user", text, time },
      reply,
    ]);
    setDraft("");
    return reply;
  }
  return { messages, draft, setDraft, send, ready };
}
