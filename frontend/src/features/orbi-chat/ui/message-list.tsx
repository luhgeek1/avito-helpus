import { RotateCcw, ThumbsDown, ThumbsUp } from "lucide-react";
import { cx } from "@/shared/lib/cx";
import { formatTime } from "@/shared/lib/orbi-format";
import { useOrbiChat } from "../model/store";
import type { MessagePart, OrbiMessage } from "../model/message";
import { ActionCardView, EquipmentMini, EscalationNote, PlanMini, RequestCardView, SourcesBlock } from "./cards";
import { RichText } from "./rich-text";

function Part({ part, busy, onDecide }: { part: MessagePart; busy: boolean; onDecide: (id: string, decision: "approve" | "reject", edits: Record<string, string>) => void }) {
  switch (part.type) {
    case "text": return part.text.trim() ? <RichText text={part.text} /> : null;
    case "sources": return <SourcesBlock data={part.data} />;
    case "action": return <ActionCardView data={part.data} busy={busy} onDecide={(decision, edits) => onDecide(part.data.id, decision, edits)} />;
    case "request": return <RequestCardView data={part.data} />;
    case "escalation": return <EscalationNote data={part.data} />;
    case "plan": return <PlanMini data={part.data} />;
    case "equipment": return <EquipmentMini data={part.data} />;
  }
}

/** Where cards go: sources after the text, an action card and results at the end. */
function ordered(parts: MessagePart[]): MessagePart[] {
  const rank = (part: MessagePart) => (part.type === "text" ? 0 : part.type === "sources" ? 1 : 2);
  return parts.map((part, index) => ({ part, index })).sort((a, b) => rank(a.part) - rank(b.part) || a.index - b.index).map(({ part }) => part);
}

function Bubble({ message, name, busy, retry }: { message: OrbiMessage; name: string; busy: boolean; retry?: () => void }) {
  const decide = useOrbiChat((state) => state.decide);
  const rate = useOrbiChat((state) => state.rate);
  const user = message.role === "user";
  const empty = !message.parts.some((part) => part.type !== "text" || part.text.trim());
  const time = formatTime(message.createdAt);
  return (
    <article data-role={message.role} aria-busy={message.streaming || undefined}
      className={cx("w-fit max-w-[92%] rounded-xl px-3.5 py-3", user ? "ml-auto bg-blue-soft" : "bg-control", !user && !empty && "w-full")}>
      <p className="mb-1 flex items-center gap-2 text-10 font-semibold text-dark">
        {user ? "Ты" : name}
        {message.mode === "offline" && <span className="rounded bg-white px-1.5 py-px text-9 font-semibold text-[#9a5d00]" title="Языковая модель недоступна: отвечаю по правилам">офлайн-режим</span>}
      </p>
      <div className="space-y-2.5 break-words text-13 leading-[1.55] [overflow-wrap:anywhere]">
        {ordered(message.parts).map((part, index) => (
          <Part key={part.type === "text" ? part.id : `${part.type}-${"id" in part.data ? String(part.data.id) : index}`} part={part} busy={busy}
            onDecide={(id, decision, edits) => { void decide(id, decision, edits); }} />
        ))}
      </div>
      {message.status && (
        <p className="mt-1 flex items-center gap-2 text-12 text-[#687181]" role="status">
          <span className="inline-flex gap-0.5" aria-hidden>
            {["[animation-delay:0ms]", "[animation-delay:150ms]", "[animation-delay:300ms]"].map((delay) => <span key={delay} className={cx("size-1.5 animate-pulse rounded-full bg-[#9aa3b2] motion-reduce:animate-none", delay)} />)}
          </span>
          {message.status}
        </p>
      )}
      {message.error && (
        <div className="mt-1.5 flex flex-wrap items-center gap-2 rounded-lg bg-red-soft px-2.5 py-2 text-12" role="alert">
          <span className="flex-1">{message.error}</span>
          {retry && <button type="button" onClick={retry} disabled={busy}
            className="inline-flex h-8 items-center gap-1 rounded-lg bg-white px-2.5 font-semibold text-ink hover:bg-control disabled:opacity-50">
            <RotateCcw size={13} aria-hidden /> Повторить
          </button>}
        </div>
      )}
      <div className="mt-1 flex items-center justify-end gap-1">
        {!user && !message.streaming && !message.error && !empty && !message.id.startsWith("local-") && (
          <>
            <button type="button" aria-label="Полезный ответ" aria-pressed={message.feedback === "up"} onClick={() => { void rate(message.id, "up"); }}
              className={cx("grid size-7 place-items-center rounded-md text-[#9aa3b2] hover:bg-white hover:text-ink", message.feedback === "up" && "text-green-text")}>
              <ThumbsUp size={13} aria-hidden />
            </button>
            <button type="button" aria-label="Бесполезный ответ" aria-pressed={message.feedback === "down"} onClick={() => { void rate(message.id, "down"); }}
              className={cx("grid size-7 place-items-center rounded-md text-[#9aa3b2] hover:bg-white hover:text-ink", message.feedback === "down" && "text-red-text")}>
              <ThumbsDown size={13} aria-hidden />
            </button>
          </>
        )}
        {time && <span className="text-9 tabular-nums text-[#687181]">{time}</span>}
      </div>
    </article>
  );
}

export function OrbiMessageList({ name }: { name: string }) {
  const messages = useOrbiChat((state) => state.messages);
  const busy = useOrbiChat((state) => state.busy);
  const send = useOrbiChat((state) => state.send);
  const lastUser = [...messages].reverse().find((message) => message.role === "user");
  const retryText = lastUser?.parts.find((part) => part.type === "text")?.text;
  return (
    <>
      {messages.map((message, index) => (
        <Bubble key={`${message.id}-${index}`} message={message} name={name} busy={busy}
          retry={index === messages.length - 1 && message.error && retryText ? () => { void send(retryText); } : undefined} />
      ))}
    </>
  );
}
