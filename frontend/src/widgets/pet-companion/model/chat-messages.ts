import { hasCards, textOf } from "@/features/orbi-chat";
import type { OrbiMessage } from "@/features/orbi-chat";

/** A short line the pet says in its pixel dialogue. */
export type ChatMessage = { id: string; text: string };

const DIALOGUE_LIMIT = 320;

/** What the pet says after a Spotlight question; long or card answers point to the chat. */
export function dialogueReply(message: OrbiMessage | undefined): { reply: ChatMessage; openChat: boolean } {
  if (!message) return { reply: { id: `none-${Date.now()}`, text: "Не получилось спросить. Открой чат и попробуй ещё раз." }, openChat: true };
  if (message.error) return { reply: { id: message.id, text: message.error }, openChat: false };
  const text = textOf(message);
  if (hasCards(message) && message.parts.some((part) => part.type === "action")) {
    return { reply: { id: message.id, text: "Подготовил карточку — открыл чат, проверь и подтверди." }, openChat: true };
  }
  if (text.length > DIALOGUE_LIMIT || hasCards(message)) {
    const cut = text.slice(0, DIALOGUE_LIMIT).replace(/\s+\S*$/, "");
    return { reply: { id: message.id, text: `${cut}… Полный ответ с источниками — в чате.` }, openChat: false };
  }
  return { reply: { id: message.id, text: text || "Готово." }, openChat: false };
}

export const SIGN_IN_REPLY: ChatMessage = { id: "sign-in", text: "Сначала войди в Хаб — тогда я увижу твой план и смогу помочь." };
