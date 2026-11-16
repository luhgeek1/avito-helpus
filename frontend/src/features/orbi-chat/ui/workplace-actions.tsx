import { useState } from "react";
import { ArrowUpRight, CalendarDays, HeartPulse, KeyRound, Laptop, MessageCircle, Palmtree, Send, Sun } from "lucide-react";
import { WORKPLACE_ACTIONS, type ActionId } from "../config/actions";
import { useOrbiChat } from "../model/store";
import { WorkplaceActionForm } from "./action-form";

const icons = { vacation: Palmtree, "day-off": Sun, sick: HeartPulse, access: KeyRound, it: Laptop, mentor: MessageCircle, team: Send };

export function WorkplaceActions({ onDone }: { onDone: () => void }) {
  const [selected, setSelected] = useState<ActionId | null>(null);
  const { send, busy } = useOrbiChat();
  const prepare = (text: string) => { void send(text); onDone(); };
  if (selected) return <WorkplaceActionForm key={selected} id={selected} busy={busy} onBack={() => setSelected(null)} onPrepare={prepare} />;
  return (
    <section aria-label="Действия Орби" className="space-y-4">
      <div><p className="text-10 font-semibold uppercase tracking-wider text-secondary">Меньше рутины</p>
        <h3 className="mt-1 text-20 font-semibold text-dark">Что сделать для тебя?</h3>
        <p className="mt-1 text-12 leading-relaxed text-secondary">Выбери задачу, заполни детали и проверь карточку.</p>
      </div>
      <div className="overflow-hidden rounded-xl border border-line divide-y divide-line">
        {WORKPLACE_ACTIONS.map((action) => {
          const Icon = icons[action.id];
          return <button key={action.id} type="button" disabled={busy} onClick={() => setSelected(action.id)}
            className="flex min-h-14 w-full items-center gap-3 bg-white px-3 py-2.5 text-left hover:bg-lilac-soft focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-dark disabled:opacity-50">
            <Icon size={18} className="shrink-0 text-lilac" aria-hidden />
            <span className="min-w-0 flex-1"><span className="block text-13 font-semibold text-dark">{action.title}</span><span className="block text-11 text-secondary">{action.detail}</span></span>
            <ArrowUpRight size={14} className="shrink-0 text-secondary" aria-hidden />
          </button>;
        })}
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Посмотреть информацию">
        {["Мои заявки", "Сколько осталось дней отпуска?", "Покажи мои встречи на неделю"].map((text) => (
          <button key={text} type="button" disabled={busy} onClick={() => prepare(text)} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-control px-3 text-left text-11 font-medium text-ink hover:bg-lilac-soft focus-visible:outline-2 focus-visible:outline-dark disabled:opacity-50">
            <CalendarDays size={13} aria-hidden /> {text}
          </button>
        ))}
      </div>
      <p className="text-10 leading-relaxed text-secondary">Демо на синтетических данных. Заявки поступают в имитацию корпоративных сервисов.</p>
    </section>
  );
}
