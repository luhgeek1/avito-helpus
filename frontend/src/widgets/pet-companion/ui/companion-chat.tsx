import { useEffect, useRef } from "react";
import type { CSSProperties, RefObject } from "react";
import { ArrowLeft, ArrowUp, X } from "lucide-react";
import { useChatPlacement } from "../model/use-chat-placement";
import type { useCompanionChat } from "../model/use-companion-chat";

export function CompanionChat({ anchor, position, name, chat, onClose, onBack, topInset = 0 }: {
  anchor: RefObject<HTMLDivElement | null>; position: CSSProperties; name: string;
  chat: ReturnType<typeof useCompanionChat>; onClose: () => void; onBack: () => void; topInset?: number;
}) {
  const style = useChatPlacement(anchor, position, topInset);
  const history = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (history.current) history.current.scrollTop = history.current.scrollHeight;
  }, [chat.messages, style.height, style.width]);
  useEffect(() => {
    if (style.visibility === "hidden") return;
    const target = matchMedia("(pointer: fine)").matches ? input.current : close.current;
    target?.focus({ preventScroll: true });
  }, [style.visibility]);
  return (
    <section id="companion-chat" role="dialog" aria-labelledby="companion-chat-title" style={style}
      className="companion-chat fixed z-40 flex flex-col rounded-2xl border-2 border-dark bg-white text-ink
        shadow-pop animate-appear motion-reduce:animate-none">
      <header className="flex shrink-0 rounded-t-2xl bg-white items-center gap-2 border-b border-dark/10 py-3 pl-5 pr-2">
        <button type="button" onClick={onBack} aria-label="Назад к меню пета"
          className="grid size-11 shrink-0 place-items-center rounded-xl bg-transparent text-dark hover:bg-control focus-visible:outline-2 focus-visible:outline-dark">
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 id="companion-chat-title" className="truncate font-sans text-14 font-semibold leading-5 text-dark">{name}</h2>
          <p className="text-11 text-[#687181]">Твой напарник рядом</p>
        </div>
        <button ref={close} type="button" onClick={onClose} aria-label="Закрыть чат"
          className="grid size-11 shrink-0 place-items-center rounded-xl bg-transparent text-secondary hover:bg-control hover:text-dark focus-visible:outline-2 focus-visible:outline-dark">
          <X size={18} />
        </button>
      </header>
      <div ref={history} role="log" aria-label="История сообщений" aria-live="polite" tabIndex={0}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-5 [scrollbar-color:#cbd3df_#ffffff]
          focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-dark">
        <p className="mb-4 text-center text-10 text-[#687181]">Начало диалога</p>
        {chat.messages.map((message) => (
          <article key={message.id} data-role={message.role}
            className={`w-fit max-w-[90%] rounded-xl px-3.5 py-3 ${message.role === "user"
              ? "ml-auto bg-blue-soft" : "bg-control"}`}>
            <p className="mb-1 text-10 font-semibold text-dark">{message.role === "user" ? "Ты" : name}</p>
            <p className="whitespace-pre-wrap break-words text-13 leading-[1.55] [overflow-wrap:anywhere]">{message.text}</p>
            <p className="mt-1 text-right text-9 tabular-nums text-[#687181]">{message.time}</p>
          </article>
        ))}
      </div>
      <form className="shrink-0 rounded-b-2xl border-t border-dark/10 bg-white p-3" onSubmit={(event) => { event.preventDefault(); chat.send(); }}>
        <div className="flex items-center gap-2 rounded-xl border border-dark bg-white p-1 focus-within:ring-1 focus-within:ring-dark">
          <textarea ref={input} aria-label="Сообщение спутнику" placeholder="Напиши сообщение…" rows={1} maxLength={2000}
            value={chat.draft} onChange={(event) => chat.setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault(); chat.send();
              }
            }}
            className="h-8 min-w-0 flex-1 resize-none rounded-lg bg-transparent px-2 py-1 text-16 leading-6 text-ink outline-none placeholder:text-secondary sm:text-13" />
          <button type="submit" aria-label="Отправить сообщение" disabled={!chat.ready || !chat.draft.trim()}
            className="relative grid size-8 shrink-0 place-items-center rounded-full bg-blue text-white transition-colors hover:bg-blue-hover
              after:absolute after:-inset-1.5 after:rounded-full after:content-['']
              disabled:cursor-default disabled:bg-blue-soft disabled:text-blue/50 focus-visible:outline-2 focus-visible:outline-dark motion-reduce:transition-none">
            <ArrowUp size={18} aria-hidden="true" />
          </button>
        </div>
      </form>
    </section>
  );
}
