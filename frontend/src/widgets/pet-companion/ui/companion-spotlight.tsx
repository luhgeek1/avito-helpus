import { useEffect, useRef } from "react";
import { ArrowUp } from "lucide-react";
import { PixelPet } from "@/entities/pet";
import type { Pet } from "@/entities/pet";
import type { CompanionChatModel } from "../model/use-companion-chat";
import { useSpotlightPosition } from "../model/use-spotlight-position";
import { dialogueReply, SIGN_IN_REPLY } from "../model/chat-messages";
import type { ChatMessage } from "../model/chat-messages";

export function CompanionSpotlight({ pet, chat, onClose, onReply, onOpenChat }: {
  pet: Pet; chat: CompanionChatModel; onClose: () => void; onReply: (reply: ChatMessage) => void; onOpenChat: () => void;
}) {
  async function submit() {
    if (!chat.draft.trim()) return;
    if (!chat.authenticated) { onReply(SIGN_IN_REPLY); return; }
    onReply({ id: `thinking-${Date.now()}`, text: "Думаю…" });
    const { reply, openChat } = dialogueReply(await chat.send());
    if (openChat) onOpenChat(); else onReply(reply);
  }
  const movement = useSpotlightPosition();
  const { onKeyDown: moveWithKeyboard, ...dragHandlers } = movement.handlers;
  const input = useRef<HTMLInputElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (movement.style.visibility === "hidden") return;
    const previous = document.activeElement;
    input.current?.focus({ preventScroll: true });
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault(); event.stopPropagation(); close.current();
    };
    document.addEventListener("keydown", escape, true);
    return () => {
      document.removeEventListener("keydown", escape, true);
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true });
    };
  }, [movement.style.visibility]);
  return (
    <section ref={movement.ref} role="dialog" aria-label={`Запрос к ${pet.name}`} style={movement.style} tabIndex={0}
      {...dragHandlers} onKeyDown={event => { if (event.target === event.currentTarget) moveWithKeyboard(event); }}
      onDragStart={event => event.preventDefault()}
      className="companion-spotlight fixed z-50 flex max-h-[calc(100dvh-16px)] w-[min(640px,calc(100vw-16px))] flex-col gap-2
        cursor-default touch-none select-none text-ink outline-none focus-visible:outline-2 focus-visible:outline-[#bcb2d1]
        animate-appear motion-reduce:animate-none">
      <form
        className="flex h-14 shrink-0 cursor-default touch-none items-center gap-1 rounded-full border border-[#d5d6dc] bg-white pl-3 pr-3
          shadow-[inset_0_0_0_1px_#ffffff,0_6px_20px_#25252b26,0_1px_4px_#25252b14]"
        onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        <span data-spotlight-icon aria-hidden="true" className="grid h-13 w-11 shrink-0 place-items-center">
          <PixelPet pet={pet} size={32} paused />
        </span>
        <input ref={input} type="text" aria-label="Запрос для пета" placeholder="Спросить Орби" maxLength={2000}
          autoComplete="off" enterKeyHint="send" value={chat.draft} onChange={event => chat.setDraft(event.target.value)}
          onKeyDown={event => { if (event.key === "Enter" && (event.nativeEvent.isComposing || event.repeat)) event.preventDefault(); }}
          className="h-13 min-w-0 flex-1 cursor-text bg-transparent text-26 leading-normal outline-none [font-family:system-ui,sans-serif] placeholder:text-[#96969d] max-sm:text-21" />
        {chat.draft.trim() && <button type="submit" aria-label="Отправить запрос" disabled={chat.busy}
          className="grid size-9 shrink-0 place-items-center rounded-full bg-[#eeedf2] text-[#68616f] transition-colors hover:bg-[#e1dce9]
            disabled:cursor-default disabled:text-[#b5aabd] motion-reduce:transition-none">
          <ArrowUp size={20} aria-hidden="true" />
        </button>}
      </form>
    </section>
  );
}
