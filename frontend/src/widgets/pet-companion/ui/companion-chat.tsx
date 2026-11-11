import { useEffect, useRef } from "react";
import type { CSSProperties, RefObject } from "react";
import { X } from "lucide-react";
import { useChatPlacement } from "../model/use-chat-placement";
import type { useCompanionChat } from "../model/use-companion-chat";

export function CompanionChat({ anchor, position, name, chat, onClose }: {
  anchor: RefObject<HTMLDivElement | null>; position: CSSProperties; name: string;
  chat: ReturnType<typeof useCompanionChat>; onClose: () => void;
}) {
  const style = useChatPlacement(anchor, position);
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
      className="companion-chat fixed z-40 flex flex-col border-[3px] border-[#e9e5ff] bg-[#303552] text-[#faf7ff]
        shadow-[0_0_0_3px_#373b60,6px_6px_0_3px_#373b6026] animate-appear motion-reduce:animate-none">
      <header className="flex shrink-0 items-center gap-3 border-b-2 border-[#484c6e] py-2 pl-4 pr-2">
        <div className="min-w-0 flex-1">
          <h2 id="companion-chat-title" className="truncate font-pixel text-[10px] leading-5 text-[#9de1f3]">{name}</h2>
          <p className="text-[11px] text-[#c7bbdf]">Твой напарник рядом</p>
        </div>
        <button ref={close} type="button" onClick={onClose} aria-label="Закрыть чат"
          className="grid size-11 shrink-0 place-items-center bg-transparent text-[#c7bbdf] hover:text-white focus-visible:outline-2 focus-visible:outline-[#9de1f3]">
          <X size={18} />
        </button>
      </header>
      <div ref={history} role="log" aria-label="История сообщений" aria-live="polite" tabIndex={0}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 py-4 [scrollbar-color:#82769c_#303552]
          focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#9de1f3]">
        <p className="mb-4 text-center text-[10px] text-[#bfb3d4]">Начало диалога</p>
        {chat.messages.map((message) => (
          <article key={message.id} data-role={message.role}
            className={`w-fit max-w-[90%] border-l-2 px-3 py-2 ${message.role === "user"
              ? "ml-auto border-[#9de1f3] bg-[#465c78]" : "border-[#bca7e5] bg-[#3e4364]"}`}>
            <p className="mb-1 text-[10px] font-semibold text-[#d6c9ed]">{message.role === "user" ? "Ты" : name}</p>
            <p className="whitespace-pre-wrap break-words text-[13px] leading-[1.55] [overflow-wrap:anywhere]">{message.text}</p>
            <p className="mt-1 text-right text-[9px] tabular-nums text-[#c7c5dc]">{message.time}</p>
          </article>
        ))}
      </div>
      <form className="shrink-0 border-t-2 border-[#484c6e] p-3" onSubmit={(event) => { event.preventDefault(); chat.send(); }}>
        <div className="flex items-center gap-2 border-2 border-[#756b96] bg-[#272d49] p-1 focus-within:border-[#9de1f3]">
          <textarea ref={input} aria-label="Сообщение спутнику" placeholder="Напиши сообщение…" rows={1} maxLength={2000}
            value={chat.draft} onChange={(event) => chat.setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault(); chat.send();
              }
            }}
            className="h-8 min-w-0 flex-1 resize-none bg-transparent px-1 py-1 text-[16px] leading-6 text-white outline-none placeholder:text-[#b8b0cd] sm:text-[13px]" />
          <button type="submit" aria-label="Отправить сообщение" disabled={!chat.ready || !chat.draft.trim()}
            className="grid size-8 shrink-0 place-items-center bg-[#9de1f3] text-[#303552] transition-colors hover:bg-[#c2edfa]
              disabled:cursor-default disabled:bg-[#484c6e] disabled:text-[#b0a5c3] focus-visible:outline-2 focus-visible:outline-white motion-reduce:transition-none">
            <svg width="16" height="16" viewBox="0 0 20 20" shapeRendering="crispEdges" aria-hidden="true">
              <path d="M8 2h4v2h2v2h2v2h2v2h-4V8h-2v10H8V8H6v2H2V8h2V6h2V4h2z" fill="currentColor" />
            </svg>
          </button>
        </div>
      </form>
    </section>
  );
}
