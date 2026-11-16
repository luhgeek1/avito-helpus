import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowUp, SquarePen, X } from "lucide-react";
import { OrbiMessageList, OrbiSuggestions, WorkplaceActions } from "@/features/orbi-chat";
import { GuideMessages } from "@/features/integration-assistant";
import { useOrbiMe } from "@/shared/api";
import { cx } from "@/shared/lib/cx";
import { firstName } from "@/shared/lib/orbi-format";
import { Link } from "@/shared/lib/portal-navigation";
import { useChatPlacement } from "../model/use-chat-placement";
import type { CompanionChatModel } from "../model/use-companion-chat";
import type { ChatBoundary } from "../model/companion-boundary";

export function CompanionChat({ name, chat, onClose, onBack, onBoundaryChange, topInset = 0 }: {
  name: string;
  chat: CompanionChatModel; onClose: () => void; onBack: () => void; topInset?: number;
  onBoundaryChange?: (boundary: ChatBoundary | null) => void;
}) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const { style, handles, moving, rect } = useChatPlacement(topInset);
  useLayoutEffect(() => { onBoundaryChange?.(rect); }, [rect, onBoundaryChange]);
  useLayoutEffect(() => () => onBoundaryChange?.(null), [onBoundaryChange]);
  const { data: me } = useOrbiMe();
  const startOver = chat.startOver;
  const { authenticated, load } = chat;
  useEffect(() => { if (authenticated) void load(); }, [authenticated, load]);
  const showActions = actionsOpen && authenticated && chat.kind === "workspace";
  const history = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const log = history.current;
    if (!log) return;
    if (showActions) { log.scrollTop = 0; return; }
    const question = chat.kind === "guide" ? log.querySelectorAll<HTMLElement>('[data-role="user"]').item(chat.messages.filter((message) => message.role === "user").length - 1) : null;
    log.scrollTop = question ? log.scrollTop + question.getBoundingClientRect().top - log.getBoundingClientRect().top : log.scrollHeight;
  }, [chat.messages, style.height, style.width, showActions]);
  useEffect(() => {
    if (style.visibility === "hidden") return;
    const target = matchMedia("(pointer: fine)").matches ? input.current : close.current;
    target?.focus({ preventScroll: true });
  }, [style.visibility]);
  return (
    <section id="companion-chat" role="dialog" aria-labelledby="companion-chat-title" style={style}
      className="companion-chat fixed z-40 flex flex-col rounded-2xl border-2 border-dark bg-white text-ink
        shadow-pop animate-appear motion-reduce:animate-none">
      <button type="button" aria-label="Изменить ширину чата" title="Потяни край или нажми ← / →"
        className="absolute -left-2 top-8 bottom-8 z-1 w-4 touch-none! cursor-ew-resize rounded-lg bg-transparent focus-visible:outline-dark"
        {...handles("width")} />
      <button type="button" aria-label="Изменить высоту чата" title="Потяни край или нажми ↑ / ↓"
        className="absolute -top-2 left-8 right-8 z-1 h-4 touch-none! cursor-ns-resize rounded-lg bg-transparent focus-visible:outline-dark"
        {...handles("height")} />
      <button type="button" aria-label="Изменить размер чата" title="Потяни угол или используй стрелки"
        className="absolute -top-3 -left-3 z-2 size-11 touch-none! cursor-nwse-resize rounded-xl bg-transparent focus-visible:outline-dark"
        {...handles("both")} />
      <header tabIndex={0} role="group" aria-label="Переместить чат" title="Перетащи за шапку или используй стрелки"
        {...handles("move")}
        className={cx("flex shrink-0 touch-none! select-none rounded-t-2xl bg-white items-center gap-2 border-b border-dark/10 py-3 pl-5 pr-2 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-dark",
          moving ? "cursor-grabbing" : "cursor-grab")}>
        <button type="button" onClick={showActions ? () => setActionsOpen(false) : onBack}
          aria-label={showActions ? "Вернуться в чат" : "Назад к меню пета"}
          className={cx("flex h-11 items-center rounded-xl bg-transparent text-dark hover:bg-control focus-visible:outline-2 focus-visible:outline-dark",
            showActions ? "min-w-0 flex-1 gap-3 px-3" : "size-11 shrink-0 justify-center")}>
          <ArrowLeft size={20} className="shrink-0" aria-hidden="true" />
          {showActions && <span className="truncate text-14 font-semibold">Вернуться в чат</span>}
        </button>
        <div className={cx("min-w-0 flex-1", showActions && "sr-only")}>
          <h2 id="companion-chat-title" className="truncate font-sans text-14 font-semibold leading-5 text-dark">{name}</h2>
          <p className="text-11 text-[#687181]">{chat.kind === "guide" ? "Помощь с интеграцией, по руководству" : me ? `${me.full_name}, ${me.role_title}` : "Перетащи за шапку"}</p>
        </div>
        {!showActions && authenticated && chat.messages.length > 0 && (
          <button type="button" onClick={startOver} aria-label="Новый диалог" title="Новый диалог" disabled={chat.busy}
            className="grid size-11 shrink-0 place-items-center rounded-xl bg-transparent text-secondary hover:bg-control hover:text-dark disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-dark">
            <SquarePen size={17} aria-hidden="true" />
          </button>
        )}
        <button ref={close} type="button" onClick={onClose} aria-label="Закрыть чат"
          className="grid size-11 shrink-0 place-items-center rounded-xl bg-transparent text-secondary hover:bg-control hover:text-dark focus-visible:outline-2 focus-visible:outline-dark">
          <X size={18} />
        </button>
      </header>
      {chat.kind === "workspace" && authenticated && !showActions && (
        <div className="shrink-0 border-b border-line px-4 py-1">
          <button type="button" onClick={() => setActionsOpen(true)} disabled={chat.busy}
            className="min-h-11 rounded-lg px-2 text-12 font-semibold text-blue-text hover:bg-control disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-dark">
            Действия: оформить и отправить
          </button>
        </div>
      )}
      <div ref={history} role={showActions ? "region" : "log"} aria-label={showActions ? "Оформление с Орби" : "История сообщений"} aria-live={showActions ? "off" : "polite"} tabIndex={0}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-5 [scrollbar-color:#cbd3df_#ffffff]
          focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-dark">
        {showActions ? <WorkplaceActions onDone={() => setActionsOpen(false)} /> : chat.kind === "guide" ? <GuideMessages name={name} /> : !authenticated ? (
          <div className="space-y-3">
            <article data-role="assistant" className="w-fit max-w-[92%] rounded-xl bg-control px-3.5 py-3">
              <p className="mb-1 text-10 font-semibold text-dark">{name}</p>
              <p className="text-13 leading-[1.55]">
                {chat.status === "unknown" ? "Проверяю, кто ты…" : "Привет! Войди под своей учёткой — тогда я увижу твой план адаптации, заявки и смогу помочь."}
              </p>
            </article>
            {chat.status === "anonymous" && (
              <Link to="/login" onClick={onClose}
                className="inline-flex h-10 items-center rounded-xl bg-blue px-4 text-13 font-semibold text-white hover:bg-blue-hover focus-visible:outline-2 focus-visible:outline-dark">
                Войти
              </Link>
            )}
          </div>
        ) : chat.messages.length === 0 ? (
          <OrbiSuggestions name={name} firstName={me ? firstName(me.full_name) : undefined} />
        ) : (
          <>
            <p className="mb-4 text-center text-10 text-[#687181]">Начало диалога</p>
            <OrbiMessageList name={name} />
          </>
        )}
      </div>
      {!showActions && <form className="shrink-0 rounded-b-2xl border-t border-dark/10 bg-white p-3" onSubmit={(event) => { event.preventDefault(); void chat.send(); }}>
        <div className="flex items-center gap-2 rounded-xl border border-dark bg-white p-1 focus-within:ring-1 focus-within:ring-dark">
          <textarea ref={input} aria-label="Сообщение спутнику" placeholder={chat.kind === "guide" ? "Вопрос об установке…" : authenticated ? "Напиши сообщение…" : "Сначала войди"} disabled={!authenticated} rows={1} maxLength={2000}
            value={chat.draft} onChange={(event) => chat.setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault(); void chat.send();
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
      </form>}
    </section>
  );
}
