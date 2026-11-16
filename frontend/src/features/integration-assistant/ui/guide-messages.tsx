import { ArrowUpRight, MessageCircle } from "lucide-react";
import { guideTopics } from "@/shared/config";
import { CodeBlock } from "@/shared/ui/code-block";
import { Link } from "@/shared/lib/portal-navigation";
import { cx } from "@/shared/lib/cx";
import { useIntegrationAssistant } from "../model/store";

export function GuideMessages({ name }: { name: string }) {
  const { messages, ask } = useIntegrationAssistant();
  if (!messages.length) return <div className="space-y-4">
    <div className="rounded-xl bg-[#f3f5f8] p-4">
      <MessageCircle size={20} className="mb-3 text-lilac" aria-hidden />
      <p className="text-14 font-semibold">Помогу установить себя</p>
      <p className="mt-2 text-13 leading-5 text-[#687181]">Спроси про запуск, код встраивания или ошибку. Отвечаю по этому руководству, без входа и внешней LLM.</p>
    </div>
    <Link to="/demo" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-lilac-soft px-3 text-12 font-semibold text-dark">
      Попробовать рабочие действия в демо <ArrowUpRight size={14} aria-hidden />
    </Link>
    {["С чего начать установку?", "Как встроить в Next.js?", "API возвращает 502 — что проверить?"].map((question) => <button key={question} onClick={() => ask(question)}
      className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-line px-3 py-2 text-left text-12 hover:bg-canvas">
      {question}<ArrowUpRight size={15} aria-hidden />
    </button>)}
  </div>;
  return <div className="space-y-4">{messages.map((message) => <article key={message.id} data-role={message.role}
    aria-label={message.role === "user" ? "Твоё сообщение" : `Сообщение ${name}`}
    className={cx("min-w-0 w-fit max-w-[92%] rounded-xl px-3 py-2 text-14 leading-5", message.role === "user" ? "ml-auto bg-[#e6f5fd]" : "bg-[#f3f5f8]")}>
    <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{message.text}</p>
    {message.topics.map((id) => {
      const topic = guideTopics.find((item) => item.id === id)!;
      return <div key={id} className="mt-3 space-y-2">
        {topic.code && <CodeBlock code={topic.code.value} language={topic.code.language} title={topic.code.title} />}
        <Link to={`/#${topic.section}`} className="inline-flex min-h-11 items-center gap-1 text-12 font-medium text-[#5e4b9b] underline decoration-[#cbbce7] underline-offset-4">
          В руководстве: {topic.title}<ArrowUpRight size={13} aria-hidden />
        </Link>
      </div>;
    })}
  </article>)}</div>;
}
