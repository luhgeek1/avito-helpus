import { useState } from "react";
import { AlertTriangle, BookOpen, CheckCircle2, Clock3, Laptop, ListChecks, Send, UserRound, XCircle } from "lucide-react";
import { useReportConflict } from "@/shared/api";
import { Link } from "@/shared/lib/portal-navigation";
import { cx } from "@/shared/lib/cx";
import { formatDay, formatMoment } from "@/shared/lib/orbi-format";
import type { ActionData, EquipmentData, EscalationData, PlanData, RequestData, SourcesData } from "../model/message";

const card = "rounded-xl border border-[#cbd3df] bg-white p-3 text-12 leading-[1.5] text-ink";
const smallButton = "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-12 font-semibold transition-colors duration-150 disabled:cursor-default disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-dark";

/* ---------- sources and conflicts ---------- */

export function SourcesBlock({ data }: { data: SourcesData }) {
  const [open, setOpen] = useState<number | null>(null);
  const report = useReportConflict();
  if (!data.sources.length && !data.conflicts.length) return null;
  return (
    <div className="space-y-2">
      {data.conflicts.map((conflict) => (
        <div key={conflict.id} className="rounded-xl border border-orange/40 bg-orange-soft/60 p-3 text-12 leading-[1.5]" role="note">
          <p className="mb-1.5 flex items-center gap-1.5 font-semibold text-ink"><AlertTriangle size={14} className="text-orange" aria-hidden /> Инструкции расходятся</p>
          <p className="mb-2 text-[#4b4b55]">{conflict.summary}</p>
          <div className="grid gap-1.5">
            <blockquote className="rounded-lg bg-white/80 p-2"><span className="block text-10 font-semibold uppercase tracking-wide text-muted">Общий регламент</span>{conflict.company.excerpt}</blockquote>
            <blockquote className="rounded-lg bg-white/80 p-2"><span className="block text-10 font-semibold uppercase tracking-wide text-muted">Команда{conflict.team.team ? ` · ${conflict.team.team}` : ""}</span>{conflict.team.excerpt}</blockquote>
          </div>
          <button type="button" className={cx(smallButton, "mt-2 bg-white text-ink hover:bg-control")} disabled={report.isPending || report.isSuccess}
            onClick={() => report.mutate({ id: conflict.id })}>
            <UserRound size={14} aria-hidden />
            {report.isSuccess ? `Вопрос передан: ${report.data.assignee_name}` : "Уточнить у наставника"}
          </button>
        </div>
      ))}
      {data.sources.length > 0 && (
        <div className={card}>
          <p className="mb-1.5 flex items-center gap-1.5 font-semibold"><BookOpen size={14} aria-hidden /> Источники</p>
          <ol className="space-y-1">
            {data.sources.map((source) => (
              <li key={`${source.n}-${source.document}`}>
                <button type="button" aria-expanded={open === source.n} onClick={() => setOpen(open === source.n ? null : source.n)}
                  className="flex w-full items-start gap-2 rounded-lg px-1 py-1 text-left hover:bg-control focus-visible:outline-2 focus-visible:outline-dark">
                  <span className="mt-px grid size-4.5 shrink-0 place-items-center rounded bg-blue-soft text-9 font-bold text-blue-text">{source.n}</span>
                  <span className="min-w-0">
                    <span className="block font-semibold">{source.title}</span>
                    <span className="block text-11 text-[#687181]">
                      {source.section} · обновлено {formatDay(source.updated_at)}
                      {source.stale && <span className="ml-1 rounded bg-orange-soft px-1 text-[#9a5d00]">может устареть</span>}
                    </span>
                  </span>
                </button>
                {open === source.n && (
                  <div className="mx-1 mb-1 rounded-lg bg-control p-2 text-11">
                    <p className="whitespace-pre-wrap">{source.excerpt}</p>
                    {source.synthetic && <p className="mt-1 text-10 text-[#687181]">{source.label}</p>}
                  </div>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

/* ---------- confirmation card ---------- */

const LEVELS: [string, string][] = [["read", "чтение"], ["write", "редактирование"]];
const STATUS_NOTE: Record<string, { text: string; icon: typeof CheckCircle2; tone: string }> = {
  approved: { text: "Подтверждено", icon: CheckCircle2, tone: "text-green-text" },
  rejected: { text: "Отменено", icon: XCircle, tone: "text-secondary" },
  expired: { text: "Карточка устарела — попроси Орби подготовить новую", icon: Clock3, tone: "text-secondary" },
};

export function ActionCardView({ data, busy, onDecide }: {
  data: ActionData; busy: boolean; onDecide: (decision: "approve" | "reject", edits: Record<string, string>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const expired = data.status === "pending" && new Date(data.expires_at).getTime() < Date.now();
  const status = expired ? "expired" : data.status;
  const pending = status === "pending";
  const editable = data.card.fields.filter((field) => field.editable);
  const edits = Object.fromEntries(Object.entries(values).filter(([key, value]) => {
    const field = data.card.fields.find((item) => item.key === key);
    return field && value !== field.value;
  }));
  const note = STATUS_NOTE[status];
  return (
    <section className={cx(card, pending && "border-dark")} aria-label={data.card.title}>
      <p className="text-10 font-semibold uppercase tracking-wide text-[#687181]">{data.card.service}</p>
      <h4 className="mb-2 text-13 font-semibold leading-5 text-dark">{data.card.title}</h4>
      <dl className="space-y-1.5">
        {data.card.fields.map((field) => (
          <div key={field.key} className="grid grid-cols-[minmax(84px,30%)_1fr] gap-2">
            <dt className="text-[#687181]">{field.label}</dt>
            <dd className="min-w-0 break-words">
              {editing && field.editable ? (
                field.key === "level" ? (
                  <select aria-label={field.label} value={values.level ?? LEVELS.find(([, title]) => title === field.value)?.[0] ?? "read"}
                    onChange={(event) => setValues({ ...values, level: event.target.value })}
                    className="h-8 w-full rounded-lg border border-[#cbd3df] bg-white px-2 text-12">
                    {LEVELS.map(([value, title]) => <option key={value} value={value}>{title}</option>)}
                  </select>
                ) : (
                  <textarea aria-label={field.label} rows={3} value={values[field.key] ?? field.value}
                    onChange={(event) => setValues({ ...values, [field.key]: event.target.value })}
                    className="w-full resize-y rounded-lg border border-[#cbd3df] bg-white px-2 py-1 text-16 sm:text-12" />
                )
              ) : (
                <span className={field.editable && values[field.key] !== undefined ? "font-semibold" : undefined}>
                  {field.key === "level" && values.level ? LEVELS.find(([value]) => value === values.level)?.[1] : values[field.key] ?? field.value}
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>
      {data.card.warnings.length > 0 && (
        <ul className="mt-2 space-y-1">
          {data.card.warnings.map((warning) => (
            <li key={warning} className="flex gap-1.5 rounded-lg bg-orange-soft/70 px-2 py-1.5"><AlertTriangle size={14} className="mt-0.5 shrink-0 text-orange" aria-hidden />{warning}</li>
          ))}
        </ul>
      )}
      {pending ? (
        <>
          {data.card.note && <p className="mt-2 text-11 text-[#687181]">{data.card.note}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => onDecide("approve", edits)}
              className={cx(smallButton, "bg-blue text-white hover:bg-blue-hover")}>
              <Send size={14} aria-hidden /> Подтвердить
            </button>
            {editable.length > 0 && (
              <button type="button" disabled={busy} onClick={() => setEditing(!editing)} aria-pressed={editing}
                className={cx(smallButton, "bg-control text-ink hover:bg-control-hover")}>
                {editing ? "Готово" : "Изменить"}
              </button>
            )}
            <button type="button" disabled={busy} onClick={() => onDecide("reject", {})}
              className={cx(smallButton, "bg-transparent text-secondary hover:bg-control hover:text-ink")}>
              Отменить
            </button>
          </div>
        </>
      ) : note && (
        <p className={cx("mt-2 flex items-center gap-1.5 font-semibold", note.tone)}><note.icon size={14} aria-hidden />{note.text}</p>
      )}
    </section>
  );
}

/* ---------- results ---------- */

const REQUEST_TONE: Record<string, string> = {
  submitting: "bg-control text-ink", submitted: "bg-blue-soft text-blue-text", approved: "bg-green-soft text-green-text",
  rejected: "bg-red-soft text-red-text", failed: "bg-red-soft text-red-text", cancelled: "bg-control text-secondary",
};

export function StatusPill({ status, children }: { status: string; children: string }) {
  return <span className={cx("inline-flex h-5.5 items-center rounded-md px-2 text-11 font-semibold", REQUEST_TONE[status] ?? "bg-control text-ink")}>{children}</span>;
}

export function RequestCardView({ data }: { data: RequestData }) {
  return (
    <section className={card} aria-label={`Заявка ${data.external_id ?? data.title}`}>
      <div className="mb-1 flex flex-wrap items-center gap-2">
        {data.external_id && <span className="font-mono text-11 font-semibold text-dark">{data.external_id}</span>}
        <StatusPill status={data.status}>{data.status_title}</StatusPill>
      </div>
      <p className="font-semibold">{data.title}</p>
      {data.approver && <p className="text-[#687181]">Согласует: {data.approver}</p>}
      {data.sla_due_at && data.status === "submitted" && <p className="text-[#687181]">Ответ ожидается до {formatMoment(data.sla_due_at)}</p>}
      {data.decision_comment && <p className="mt-1 rounded-lg bg-control px-2 py-1">{data.decision_comment}</p>}
      <Link to="/requests" className="mt-1.5 inline-block font-semibold text-blue-text hover:underline">Мои заявки →</Link>
    </section>
  );
}

export function EscalationNote({ data }: { data: EscalationData }) {
  return (
    <section className={cx(card, "flex gap-2")} aria-label="Вопрос передан">
      <UserRound size={16} className="mt-0.5 shrink-0 text-lilac" aria-hidden />
      <p>Вопрос передан: <strong className="font-semibold">{data.assignee}</strong>. Ответ придёт уведомлением, ориентир — до {formatMoment(data.due_at)}.</p>
    </section>
  );
}

export function PlanMini({ data }: { data: PlanData }) {
  if (!data.next_steps?.length) return null;
  return (
    <section className={card} aria-label="Ближайшие шаги">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 font-semibold"><ListChecks size={14} aria-hidden /> Ближайшие шаги</p>
        {data.percent !== undefined && <span className="text-11 text-[#687181]">план выполнен на {data.percent}%</span>}
      </div>
      {data.percent !== undefined && (
        <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-control" role="progressbar" aria-valuenow={data.percent} aria-valuemin={0} aria-valuemax={100} aria-label="Прогресс плана">
          <div className="h-full rounded-full bg-green" style={{ width: `${data.percent}%` }} />
        </div>
      )}
      <ul className="space-y-1">
        {data.next_steps.map((step) => (
          <li key={step.id} className="flex items-baseline justify-between gap-2">
            <span>{step.title}</span>
            <span className={cx("shrink-0 text-11", step.overdue ? "font-semibold text-red-text" : "text-[#687181]")}>до {formatDay(step.due)}</span>
          </li>
        ))}
      </ul>
      <Link to="/plan" className="mt-1.5 inline-block font-semibold text-blue-text hover:underline">Весь путь →</Link>
    </section>
  );
}

export function EquipmentMini({ data }: { data: EquipmentData }) {
  if (!data.items.length) return null;
  return (
    <section className={card} aria-label="Техника">
      <p className="mb-1.5 flex items-center gap-1.5 font-semibold"><Laptop size={14} aria-hidden /> Техника</p>
      <ul className="space-y-1.5">
        {data.items.map((item) => (
          <li key={`${item.kind}-${item.model}`}>
            <span className="font-semibold">{item.model}</span> — {item.status_title}
            {item.eta && <span className="text-[#687181]">, ориентир {formatDay(item.eta)}</span>}
            {item.pickup_location && <span className="block text-11 text-[#687181]">{item.pickup_location}{item.pickup_hours ? `, ${item.pickup_hours}` : ""}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
