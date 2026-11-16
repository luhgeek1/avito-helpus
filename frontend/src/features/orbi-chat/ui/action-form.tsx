import { useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { actionPrompt, localDay, WORKPLACE_ACTIONS, type ActionId } from "../config/actions";

const fieldStyle = "mt-1.5 w-full rounded-xl border border-[#cbd3df] bg-white px-3 py-2.5 text-16 text-ink outline-none focus:border-dark focus:ring-1 focus:ring-dark sm:text-13";

export function WorkplaceActionForm({ id, busy, onBack, onPrepare }: {
  id: ActionId; busy: boolean; onBack: () => void; onPrepare: (text: string) => void;
}) {
  const action = WORKPLACE_ACTIONS.find((item) => item.id === id)!;
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const today = localDay();
  return (
    <form aria-label={action.title} className="space-y-4" onSubmit={(event) => {
      event.preventDefault();
      if (action.fields.some((field) => !values[field.key]?.trim())) {
        setError("Заполни все поля — так я смогу подготовить точную заявку."); return;
      }
      if (values.start && (values.start < today || values.end < values.start)) {
        setError("Проверь даты: начало не раньше сегодня, конец не раньше начала."); return;
      }
      onPrepare(actionPrompt(id, values));
    }}>
      <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center gap-2 rounded-lg text-12 text-secondary hover:text-dark focus-visible:outline-2 focus-visible:outline-dark">
        <ArrowLeft size={14} aria-hidden /> Все действия
      </button>
      <div><h3 className="text-18 font-semibold text-dark">{action.title}</h3><p className="mt-1 text-12 leading-relaxed text-secondary">{action.hint}</p></div>
      <div className={id === "vacation" || id === "day-off" || id === "sick" ? "grid grid-cols-2 gap-3" : "space-y-3"}>
        {action.fields.map((field) => (
          <label key={field.key} className="block min-w-0 text-12 font-semibold text-ink">
            {field.label}
            {field.type === "textarea" ? (
              <textarea required maxLength={1200} rows={4} value={values[field.key] ?? ""} placeholder={field.placeholder}
                onChange={(event) => { setValues({ ...values, [field.key]: event.target.value }); setError(""); }} className={fieldStyle} />
            ) : (
              <input required type={field.type} maxLength={200} value={values[field.key] ?? ""} placeholder={field.placeholder}
                min={field.type === "date" ? (field.key === "end" ? values.start || today : today) : undefined}
                onChange={(event) => { setValues({ ...values, [field.key]: event.target.value }); setError(""); }} className={fieldStyle} />
            )}
          </label>
        ))}
      </div>
      {error && <p role="alert" className="text-12 text-red-text">{error}</p>}
      <button type="submit" disabled={busy} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue px-4 text-13 font-semibold text-white hover:bg-blue-hover disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-dark">
        Подготовить карточку <ArrowRight size={15} aria-hidden />
      </button>
      <p className="text-10 leading-relaxed text-secondary">Тестовые данные и сервисы. Не регламент Авито.</p>
    </form>
  );
}
