import type { ChatPart, UiChunk } from "@/shared/api";

export type CardField = { key: string; label: string; value: string; editable: boolean };
export type ActionCard = {
  kind: string; title: string; service: string; fields: CardField[]; warnings: string[]; note?: string | null;
};
export type ActionStatus = "pending" | "approved" | "rejected" | "expired";
export type ActionData = { id: string; tool: string; status: ActionStatus; card: ActionCard; expires_at: string };

export type SourceRef = {
  n: number; document: string; title: string; section: string; excerpt: string; scope: string;
  team: string | null; label: string; synthetic: boolean; url: string | null; updated_at: string; stale: boolean;
};
export type ConflictQuote = { title: string; section: string; excerpt: string; team?: string | null };
export type ConflictRef = { id: string; topic: string; summary: string; company: ConflictQuote; team: ConflictQuote };
export type SourcesData = { query: string; sources: SourceRef[]; conflicts: ConflictRef[]; mode: string };

export type RequestData = {
  id: string; kind: string; title: string; status: string; status_title: string; external_id: string | null;
  approver: string | null; decision_comment: string | null; sla_due_at: string | null;
};
export type EscalationData = { id: string; assignee: string; level: string; due_at: string; status: string };
export type PlanData = {
  stage?: string; percent?: number;
  next_steps?: { id: string; title: string; due: string; status: string; overdue: boolean }[];
  updated?: { id: string; status: string };
};
export type EquipmentData = {
  items: { kind: string; model: string; status_title: string; eta: string | null; pickup_location: string | null;
    pickup_hours: string | null; late?: boolean }[];
  meanwhile: { id: string; title: string }[];
};

export type MessagePart =
  | { type: "text"; id: string; text: string }
  | { type: "sources"; data: SourcesData }
  | { type: "action"; data: ActionData }
  | { type: "request"; data: RequestData }
  | { type: "escalation"; data: EscalationData }
  | { type: "plan"; data: PlanData }
  | { type: "equipment"; data: EquipmentData };

export type OrbiMessage = {
  id: string;
  role: "user" | "assistant";
  parts: MessagePart[];
  createdAt: string;
  /** Live status line while the answer is being prepared ("Ищу в базе знаний"). */
  status?: string;
  streaming?: boolean;
  error?: string;
  mode?: string;
  feedback?: "up" | "down" | null;
};

const DATA_TYPES = new Set(["sources", "action", "request", "escalation", "plan", "equipment"]);

function dataPart(type: string, data: unknown): MessagePart | null {
  const name = type.replace(/^data-/, "");
  if (!DATA_TYPES.has(name) || !data || typeof data !== "object") return null;
  return { type: name, data } as MessagePart;
}

/** Adds or refreshes a part; an action card and a request card are updated in place by id. */
function upsert(parts: MessagePart[], part: MessagePart): MessagePart[] {
  if (part.type === "action" || part.type === "request") {
    const index = parts.findIndex((existing) => existing.type === part.type && existing.data.id === part.data.id);
    if (index >= 0) return parts.map((existing, i) => (i === index ? part : existing));
  }
  return [...parts, part];
}

export function textOf(message: Pick<OrbiMessage, "parts">): string {
  return message.parts.filter((part) => part.type === "text").map((part) => part.text).join("\n\n").trim();
}

/** Applies one AI SDK UI stream chunk to the assistant message being streamed. */
export function applyChunk(message: OrbiMessage, chunk: UiChunk): OrbiMessage {
  switch (chunk.type) {
    case "start": {
      const metadata = chunk.messageMetadata as { mode?: string } | undefined;
      return { ...message, id: typeof chunk.messageId === "string" ? chunk.messageId : message.id, mode: metadata?.mode ?? message.mode };
    }
    case "text-start":
      return { ...message, parts: [...message.parts, { type: "text", id: String(chunk.id), text: "" }] };
    case "text-delta": {
      const id = String(chunk.id), delta = typeof chunk.delta === "string" ? chunk.delta : "";
      const index = message.parts.findIndex((part) => part.type === "text" && part.id === id);
      if (index < 0) return { ...message, status: undefined, parts: [...message.parts, { type: "text", id, text: delta }] };
      return {
        ...message, status: undefined,
        parts: message.parts.map((part, i) => (i === index && part.type === "text" ? { ...part, text: part.text + delta } : part)),
      };
    }
    case "error":
      return { ...message, status: undefined, error: typeof chunk.errorText === "string" ? chunk.errorText : "Орби сейчас не может ответить" };
    case "finish": {
      const metadata = chunk.messageMetadata as { messageId?: string; mode?: string } | undefined;
      return { ...message, id: metadata?.messageId ?? message.id, mode: metadata?.mode ?? message.mode, streaming: false, status: undefined };
    }
    default: {
      if (chunk.type === "data-status") {
        const data = chunk.data as { text?: unknown } | undefined;
        return typeof data?.text === "string" ? { ...message, status: data.text } : message;
      }
      if (!chunk.type.startsWith("data-")) return message;
      const part = dataPart(chunk.type, chunk.data);
      return part ? { ...message, parts: upsert(message.parts, part) } : message;
    }
  }
}

/** Message restored from GET /chat/conversations/{id}: parts are stored in the stream format. */
export function fromHistory(message: { id: string; role: string; parts: ChatPart[]; feedback: string | null; created_at: string }): OrbiMessage {
  let parts: MessagePart[] = [];
  message.parts.forEach((raw, index) => {
    if (raw.type === "text" && typeof raw.text === "string") parts.push({ type: "text", id: `${message.id}-${index}`, text: raw.text });
    else {
      const part = dataPart(raw.type, raw.data);
      if (part) parts = upsert(parts, part);
    }
  });
  return {
    id: message.id, role: message.role === "user" ? "user" : "assistant", parts, createdAt: message.created_at,
    feedback: message.feedback === "up" || message.feedback === "down" ? message.feedback : null,
  };
}

export function hasCards(message: OrbiMessage): boolean {
  return message.parts.some((part) => part.type !== "text");
}
