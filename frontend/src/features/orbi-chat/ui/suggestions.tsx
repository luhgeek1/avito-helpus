import { useOrbiChat } from "../model/store";

export const SUGGESTIONS = [
  "Что мне делать дальше?",
  "Нужен доступ к Grafana",
  "Куда отправлять PR?",
  "Когда выдадут ноутбук?",
  "Хочу взять отгул в пятницу",
];

/** First screen of an empty conversation: a greeting and a few ready questions. */
export function OrbiSuggestions({ name, firstName }: { name: string; firstName?: string }) {
  const send = useOrbiChat((state) => state.send);
  const busy = useOrbiChat((state) => state.busy);
  return (
    <div className="space-y-3">
      <article data-role="assistant" className="w-fit max-w-[92%] rounded-xl bg-control px-3.5 py-3">
        <p className="mb-1 text-10 font-semibold text-dark">{name}</p>
        <p className="text-13 leading-[1.55]">
          {firstName ? `Привет, ${firstName}! ` : "Привет! "}
          Я знаю твой план адаптации, могу найти ответ в базе знаний, оформить доступ, отгул или обращение в IT
          и передать вопрос наставнику. Перед любой заявкой покажу карточку — отправлю только после твоего подтверждения.
        </p>
      </article>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Готовые вопросы">
        {SUGGESTIONS.map((text) => (
          <button key={text} type="button" disabled={busy} onClick={() => { void send(text); }}
            className="rounded-full border border-[#cbd3df] bg-white px-3 py-1.5 text-12 text-ink transition-colors duration-150 hover:border-dark disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-dark">
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}
