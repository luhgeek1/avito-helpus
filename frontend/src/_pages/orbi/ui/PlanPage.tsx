import { useEffect, useState } from "react";
import { AlertTriangle, BookOpen, Check, ChevronDown, Laptop, MessageCircle, Play, Send, Sparkles, UserRound } from "lucide-react";
import { useOrbiChat } from "@/features/orbi-chat";
import { useEquipment, useOrbiMe, usePlan, usePlanTransition, useSubmitQuiz } from "@/shared/api";
import type { Plan, PlanItem } from "@/shared/api";
import { cx } from "@/shared/lib/cx";
import { formatDay, plural } from "@/shared/lib/orbi-format";
import { container, heading, Modal, Skeleton } from "@/shared/ui/portal";
import { action, actionTone, card, DocumentModal, DueDate, errorText, ItemStatusPill, LoadError, muted, Progress, RequireSession } from "./common";

/** The phrase "Сделать с Орби" sends: the agent resolves the rest with its tools. */
export function orbiPhrase(item: PlanItem): string | null {
  switch (item.action?.kind) {
    case "access_request": return `Нужен доступ для шага «${item.title}»${item.action.resource ? ` (ресурс ${item.action.resource})` : ""}`;
    case "absence_request": return "Хочу оформить отгул";
    case "equipment": return "Когда выдадут ноутбук и что делать, пока его нет?";
    case "ask_mentor": return `Хочу задать вопрос наставнику по шагу «${item.title}»`;
    default: return null;
  }
}

function Quiz({ item, onClose }: { item: PlanItem; onClose: () => void }) {
  const [answers, setAnswers] = useState<(number | null)[]>(item.quiz.map(() => null));
  const submit = useSubmitQuiz();
  const result = submit.data;
  const complete = answers.every((answer) => answer !== null);
  return (
    <Modal title={`Мини-тест: ${item.title.replace(/\s*\(тест\)$/, "")}`} onClose={onClose}>
      {result?.passed ? (
        <div className="space-y-4">
          <p className="flex items-center gap-2 text-16 font-bold text-green-text"><Check size={20} aria-hidden /> Тест пройден, шаг закрыт</p>
          <button type="button" className={cx(action, actionTone.accent)} onClick={onClose}>Отлично</button>
        </div>
      ) : (
        <form className="space-y-5" onSubmit={(event) => {
          event.preventDefault();
          if (complete) submit.mutate({ id: item.id, answers: answers.map((answer) => answer ?? 0) });
        }}>
          {item.quiz.map((question, index) => (
            <fieldset key={question.question} className="space-y-2">
              <legend className="mb-2 font-bold">{index + 1}. {question.question}</legend>
              {question.options.map((option, optionIndex) => (
                <label key={option} className={cx("flex cursor-pointer items-start gap-2.5 rounded-2xl bg-fill px-3.5 py-3 hover:bg-fill-hover",
                  result?.wrong.includes(index) && answers[index] === optionIndex && "bg-red-soft hover:bg-red-soft")}>
                  <input type="radio" name={`q${index}`} className="mt-0.5 accent-blue" checked={answers[index] === optionIndex}
                    onChange={() => setAnswers(answers.map((answer, i) => (i === index ? optionIndex : answer)))} />
                  <span>{option}</span>
                </label>
              ))}
            </fieldset>
          ))}
          {result && !result.passed && <p role="alert" className="rounded-2xl bg-red-soft px-4 py-3">Есть ошибки ({plural(result.wrong.length, ["вопрос", "вопроса", "вопросов"])}). Загляни в инструкцию и попробуй ещё раз.</p>}
          {submit.isError && <p role="alert" className="rounded-2xl bg-red-soft px-4 py-3">{errorText(submit.error)}</p>}
          <button type="submit" disabled={!complete || submit.isPending} className={cx(action, actionTone.accent)}>Проверить</button>
        </form>
      )}
    </Modal>
  );
}

function StepCard({ item, highlight, onDoc, anchor = false }: { item: PlanItem; highlight: boolean; onDoc: (slug: string) => void; anchor?: boolean }) {
  const transition = usePlanTransition();
  const ask = useOrbiChat((state) => state.ask);
  const [quiz, setQuiz] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [reason, setReason] = useState("");
  const phrase = orbiPhrase(item);
  const open = item.status === "todo" || item.status === "in_progress";
  const mine = item.audience === "intern";
  const move = (name: string, comment?: string) => transition.mutate({ id: item.id, transition: name, comment }, { onSuccess: () => setBlocking(false) });
  return (
    <li id={anchor ? `step-${item.id}` : undefined} className={cx("scroll-mt-40 rounded-2xl bg-white p-4 shadow-[0_0_0_1px_rgba(0,0,0,0.06)]", highlight && "ring-2 ring-blue",
      item.status === "done" && "bg-white/60")}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1 basis-80">
          <h4 className={cx("text-16 font-bold leading-5.5", item.status === "done" && "text-secondary line-through decoration-1")}>{item.title}</h4>
          {item.description && <p className="mt-1 text-14 leading-5 text-secondary">{item.description}</p>}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <ItemStatusPill item={item} />
          <DueDate item={item} />
        </div>
      </div>
      {item.blocked_reason && item.status === "blocked" && <p className="mt-2 flex gap-2 rounded-xl bg-red-soft px-3 py-2 text-14"><AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />{item.blocked_reason}</p>}
      {item.review_comment && <p className="mt-2 flex gap-2 rounded-xl bg-purple-soft px-3 py-2 text-14"><UserRound size={16} className="mt-0.5 shrink-0" aria-hidden />Наставник: {item.review_comment}</p>}
      {item.status === "waiting" && item.waiting_reason === "mentor_review" && <p className={cx(muted, "mt-2")}>Отправлено наставнику. Он подтвердит шаг или вернёт с комментарием.</p>}
      {item.status === "waiting" && item.waiting_reason === "request" && <p className={cx(muted, "mt-2")}>Ждём решения по заявке — шаг закроется сам, когда её одобрят.</p>}
      {!mine && <p className={cx(muted, "mt-2")}>Этот шаг выполняет наставник.</p>}
      {mine && item.status !== "done" && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {phrase && open && (
            <button type="button" className={cx(action, actionTone.primary)} onClick={() => ask(phrase)}>
              <Sparkles size={16} aria-hidden /> Сделать с Орби
            </button>
          )}
          {item.status === "todo" && (
            <button type="button" className={cx(action, actionTone.secondary)} disabled={transition.isPending} onClick={() => move("start")}>
              <Play size={15} aria-hidden /> Начать
            </button>
          )}
          {open && item.confirmation === "self" && (
            <button type="button" className={cx(action, actionTone.accent)} disabled={transition.isPending} onClick={() => move("complete")}>
              <Check size={16} aria-hidden /> Готово
            </button>
          )}
          {open && item.confirmation === "quiz" && (
            <button type="button" className={cx(action, actionTone.accent)} onClick={() => setQuiz(true)}>Пройти тест</button>
          )}
          {open && item.confirmation === "mentor" && (
            <button type="button" className={cx(action, actionTone.accent)} disabled={transition.isPending} onClick={() => move("submit_review")}>
              <Send size={15} aria-hidden /> На проверку наставнику
            </button>
          )}
          {item.status === "blocked" && (
            <button type="button" className={cx(action, actionTone.secondary)} disabled={transition.isPending} onClick={() => move("unblock")}>Блокер снят</button>
          )}
          {open && !blocking && <button type="button" className={cx(action, actionTone.ghost)} onClick={() => setBlocking(true)}>Есть блокер</button>}
          {item.doc_slugs.map((slug, index) => (
            <button key={slug} type="button" className={cx(action, actionTone.ghost)} onClick={() => onDoc(slug)}>
              <BookOpen size={15} aria-hidden /> {index === 0 ? "Инструкция" : `Инструкция ${index + 1}`}
            </button>
          ))}
        </div>
      )}
      {blocking && (
        <form className="mt-3 flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); move("block", reason.trim() || undefined); }}>
          <input aria-label="Что мешает" placeholder="Что мешает? Наставник увидит это" value={reason} onChange={(event) => setReason(event.target.value)}
            className="h-9 min-w-0 flex-1 basis-60 rounded-xl border border-[#d5d6dc] bg-white px-3 text-15 outline-none focus:border-blue" />
          <button type="submit" className={cx(action, actionTone.primary)} disabled={transition.isPending}>Сообщить</button>
          <button type="button" className={cx(action, actionTone.ghost)} onClick={() => setBlocking(false)}>Отмена</button>
        </form>
      )}
      {transition.isError && <p role="alert" className="mt-2 text-14 text-red-text">{errorText(transition.error)}</p>}
      {quiz && <Quiz item={item} onClose={() => setQuiz(false)} />}
    </li>
  );
}

function Stage({ stage, current, highlight, onDoc }: { stage: Plan["stages"][number]; current: boolean; highlight?: string; onDoc: (slug: string) => void }) {
  const contains = highlight ? stage.items.some((item) => item.id === highlight) : false;
  const [open, setOpen] = useState(current || contains);
  useEffect(() => { if (contains) setOpen(true); }, [contains]);
  const items = stage.items.filter((item) => item.audience === "intern");
  return (
    <section className={card} aria-labelledby={`stage-${stage.stage}`}>
      <button type="button" className="flex w-full items-center gap-4 text-left" aria-expanded={open} onClick={() => setOpen(!open)}>
        <div className="min-w-0 flex-1">
          <h3 id={`stage-${stage.stage}`} className={heading.h3}>{stage.title}{current && <span className="ml-2 align-middle text-13 font-bold text-blue-text">сейчас</span>}</h3>
          <p className={cx(muted, "mt-1")}>{stage.done} из {stage.total} · до {formatDay(stage.due_date)}</p>
        </div>
        <span className="w-24 shrink-0 hub-max-720:w-16"><Progress percent={stage.percent} label={`Этап «${stage.title}»`} /></span>
        <ChevronDown size={20} aria-hidden className={cx("shrink-0 transition-transform duration-200 motion-reduce:transition-none", open && "rotate-180")} />
      </button>
      {open && <ul className="mt-4 space-y-2">{items.map((item) => <StepCard key={item.id} item={item} highlight={item.id === highlight} onDoc={onDoc} anchor />)}</ul>}
    </section>
  );
}

function EquipmentCard() {
  const { data } = useEquipment();
  const ask = useOrbiChat((state) => state.ask);
  const laptop = data?.items.find((item) => item.kind === "laptop");
  if (!laptop) return null;
  return (
    <section className={cx(card, "flex flex-wrap items-center gap-4")} aria-label="Ноутбук">
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white"><Laptop size={24} aria-hidden /></span>
      <div className="min-w-0 flex-1">
        <p className="font-bold">{laptop.model} — {laptop.status_title}</p>
        <p className={muted}>
          {laptop.eta ? `Ориентир ${formatDay(laptop.eta)}. ` : ""}{laptop.pickup_location ?? ""}{laptop.pickup_hours ? `, ${laptop.pickup_hours}` : ""}
        </p>
      </div>
      {laptop.status !== "issued" && (
        <button type="button" className={cx(action, actionTone.white)} onClick={() => ask("Ноутбука ещё нет — чем заняться пока?")}>Чем заняться пока</button>
      )}
    </section>
  );
}

export function PlanPage({ highlight }: { highlight?: string }) {
  return <RequireSession title="Мой путь"><PlanContent highlight={highlight} /></RequireSession>;
}

function PlanContent({ highlight }: { highlight?: string }) {
  const { data: plan, isPending, isError, error, refetch } = usePlan();
  const { data: me } = useOrbiMe();
  const ask = useOrbiChat((state) => state.ask);
  const [doc, setDoc] = useState<string | null>(null);
  useEffect(() => {
    if (!plan || !highlight) return;
    document.getElementById(`step-${highlight}`)?.scrollIntoView({ block: "center" });
  }, [plan, highlight]);
  if (isPending) return <div className={cx(container, "space-y-4")}><Skeleton height={180} /><Skeleton height={320} /></div>;
  if (isError) return <div className={container}><LoadError error={error} onRetry={() => { void refetch(); }} /></div>;
  const next = plan.next_steps;
  return (
    <div className={cx(container, "flex flex-col gap-8")}>
      <section className="grid grid-cols-[minmax(0,1fr)_320px] gap-6 rounded-3xl bg-dark px-8 py-8 text-white hub-max-900:grid-cols-1 hub-max-720:px-5 hub-max-720:py-6">
        <div>
          <p className="mb-2 text-15 text-white/70">{me?.internship_day ? `День ${me.internship_day} стажировки` : "Стажировка"} · этап «{plan.current_stage_title}»</p>
          <h1 className={cx(heading.h1, "mb-5")}>Мой путь</h1>
          <div className="mb-2 flex items-baseline justify-between gap-4">
            <span className="text-15 text-white/80">Выполнено {plan.done} из {plan.total}</span>
            <span className="text-26 font-bold tabular-nums">{plan.percent}%</span>
          </div>
          <Progress percent={plan.percent} label="Прогресс плана адаптации" />
          {plan.overdue > 0 && <p className="mt-3 inline-flex items-center gap-2 rounded-xl bg-red/20 px-3 py-1.5 text-14"><AlertTriangle size={16} aria-hidden /> Просрочено: {plural(plan.overdue, ["шаг", "шага", "шагов"])}</p>}
        </div>
        {me?.mentor && (
          <div className="flex flex-col justify-between gap-4 rounded-2xl bg-white/8 p-5">
            <div>
              <p className="text-13 text-white/60">Наставник</p>
              <p className="text-18 font-bold">{me.mentor.full_name}</p>
              <p className="text-14 text-white/70">{me.mentor.title}</p>
            </div>
            <button type="button" onClick={() => ask("Хочу задать вопрос наставнику")} className={cx(action, "bg-white text-primary hover:bg-white/90")}>
              <MessageCircle size={16} aria-hidden /> Спросить через Орби
            </button>
          </div>
        )}
      </section>

      {next.length > 0 && (
        <section aria-labelledby="next-steps">
          <h2 id="next-steps" className={cx(heading.h2, "mb-4")}>Сейчас важно</h2>
          <ul className="grid gap-3">{next.map((item) => <StepCard key={item.id} item={item} highlight={false} onDoc={setDoc} />)}</ul>
        </section>
      )}

      <EquipmentCard />

      <section aria-labelledby="all-stages" className="flex flex-col gap-3">
        <h2 id="all-stages" className={cx(heading.h2, "mb-1")}>Весь план</h2>
        {plan.stages.map((stage) => (
          <Stage key={stage.stage} stage={stage} current={stage.stage === plan.current_stage} highlight={highlight} onDoc={setDoc} />
        ))}
      </section>
      {doc && <DocumentModal slug={doc} onClose={() => setDoc(null)} />}
    </div>
  );
}
