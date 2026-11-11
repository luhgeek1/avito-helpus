import { useEffect, useRef } from "react";
import type { CSSProperties, RefObject } from "react";
import { X } from "lucide-react";
import { useChatPlacement } from "../model/use-chat-placement";
import type { useCompanionChat } from "../model/use-companion-chat";

export function CompanionChat({ anchor, position, name, chat, onClose, topInset = 0 }: {
  anchor: RefObject<HTMLDivElement | null>; position: CSSProperties; name: string;
  chat: ReturnType<typeof useCompanionChat>; onClose: () => void; topInset?: number;
}) {
  const style = useChatPlacement(anchor, position, topInset);
  const history = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (history.current) history.current.scrollTop = history.current.scrollHeight;
  }, [chat.messages, style.height]);
  useEffect(() => {
    if (style.visibility === "hidden") return;
    const target = matchMedia("(pointer: fine)").matches ? input.current : close.current;
    target?.focus({ preventScroll: true });
  }, [style.visibility]);
  return (
    <section id="companion-chat" role="dialog" aria-labelledby="companion-chat-title" style={style}
      className="companion-chat fixed z-40 flex flex-col border-[3px] border-[#f5f7fa] bg-[#ffffff] text-[#25252b]
        shadow-[0_0_0_3px_#cbd3df,6px_6px_0_3px_#cbd3df26] animate-appear motion-reduce:animate-none">
      <header className="flex shrink-0 items-center gap-3 border-b-2 border-[#e6eaf0] py-2 pl-4 pr-2">
        <div className="min-w-0 flex-1">
          <h2 id="companion-chat-title" className="truncate font-pixel text-[10px] leading-5 text-[#0079ac]">{name}</h2>
          <p className="text-[11px] text-[#687181]">Твой напарник рядом</p>
        </div>
        <button ref={close} type="button" onClick={onClose} aria-label="Закрыть чат"
          className="grid size-11 shrink-0 place-items-center bg-transparent text-[#687181] hover:text-[#25252b] focus-visible:outline-2 focus-visible:outline-[#0079ac]">
          <X size={18} />
        </button>
      </header>
      <div ref={history} role="log" aria-label="История сообщений" aria-live="polite" tabIndex={0}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 py-4 [scrollbar-color:#aeb8c6_#ffffff]
          focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#0079ac]">
        <p className="mb-4 text-center text-[10px] text-[#687181]">Начало диалога</p>
        {chat.messages.map((message) => (
          <article key={message.id} data-role={message.role}
            className={`w-fit max-w-[90%] border-l-2 px-3 py-2 ${message.role === "user"
              ? "ml-auto border-[#0079ac] bg-[#e6f5fd]" : "border-[#d3dae4] bg-[#f3f5f8]"}`}>
            <p className="mb-1 text-[10px] font-semibold text-[#006d99]">{message.role === "user" ? "Ты" : name}</p>
            <p className="whitespace-pre-wrap break-words text-[13px] leading-[1.55] [overflow-wrap:anywhere]">{message.text}</p>
            <p className="mt-1 text-right text-[9px] tabular-nums text-[#687181]">{message.time}</p>
          </article>
        ))}
      </div>
      <form className="shrink-0 border-t-2 border-[#e6eaf0] p-3" onSubmit={(event) => { event.preventDefault(); chat.send(); }}>
        <div className="flex items-center gap-2 border-2 border-[#cbd3df] bg-[#f7f9fb] p-1 focus-within:border-[#0079ac]">
          <textarea ref={input} aria-label="Сообщение спутнику" placeholder="Напиши сообщение…" rows={1} maxLength={2000}
            value={chat.draft} onChange={(event) => chat.setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault(); chat.send();
              }
            }}
            className="h-8 min-w-0 flex-1 resize-none bg-transparent px-1 py-1 text-[16px] leading-6 text-[#25252b] outline-none placeholder:text-[#687181] sm:text-[13px]" />
          <button type="submit" aria-label="Отправить сообщение" disabled={!chat.ready || !chat.draft.trim()}
            className="grid size-8 shrink-0 place-items-center bg-[#0079ac] text-[#ffffff] transition-colors hover:bg-[#006993]
              disabled:cursor-default disabled:bg-[#e6eaf0] disabled:text-[#8992a0] focus-visible:outline-2 focus-visible:outline-[#0079ac] motion-reduce:transition-none">
            <svg width="16" height="16" viewBox="0 0 20 20" shapeRendering="crispEdges" aria-hidden="true">
              <path d="M8 2h4v2h2v2h2v2h2v2h-4V8h-2v10H8V8H6v2H2V8h2V6h2V4h2z" fill="currentColor" />
            </svg>
          </button>
        </div>
      </form>
    </section>
  );
}
