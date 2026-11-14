import { useState } from "react";
import { AlertTriangle, CheckCircle2, CircleHelp, Undo2, UserRound } from "lucide-react";
import { StatusPill } from "@/features/orbi-chat";
import { useAnswerEscalation, useEscalations, useMentee, useMentees, usePermission, useReviewItem } from "@/shared/api";
import type { Escalation, Mentee, PlanItem } from "@/shared/api";
import { cx } from "@/shared/lib/cx";
import { formatDay, formatMoment, initialsOf, plural } from "@/shared/lib/orbi-format";
import { Link } from "@/shared/lib/portal-navigation";
import { container, EmptyState, heading, Skeleton } from "@/shared/ui/portal";
import { action, actionTone, card, DueDate, errorText, ItemStatusPill, LoadError, muted, Progress, RequireSession } from "./common";

function MenteeCard({ mentee, selected }: { mentee: Mentee; selected: boolean }) {
  const attention = mentee.blocked.length + mentee.awaiting_review.length + mentee.overdue;
  return (
    <li>
      <Link to="/mentor/mentees/$id" params={{ id: mentee.person.id }} aria-current={selected ? "page" : undefined}
        className={cx(card, "flex flex-col gap-3 hover:bg-fill-hover", selected && "ring-2 ring-dark")}>
        <span className="flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-blue-soft font-bold text-blue-text" aria-hidden>{initialsOf(mentee.person.full_name)}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-16 font-bold">{mentee.person.full_name}</span>
            <span className={muted}>{mentee.internship_day ? `День ${mentee.internship_day}` : "Стажёр"} · {mentee.stage_title}{mentee.person.team ? ` · ${mentee.person.team.name}` : ""}</span>
          </span>
          {mentee.needs_attention && <span className="inline-flex h-6 items-center rounded-lg bg-red-soft px-2 text-12 font-bold text-red-text">нужно внимание</span>}
        </span>
        <span className="flex items-center gap-3">
          <span className="flex-1"><Progress percent={mentee.percent} label={`План ${mentee.person.full_name}`} /></span>
          <span className="text-14 font-bold tabular-nums">{mentee.percent}%</span>
        </span>
        <span className="flex flex-wrap gap-x-4 gap-y-1 text-13 text-secondary">
          {mentee.awaiting_review.length > 0 && <span>На проверке: {mentee.awaiting_review.length}</span>}
          {mentee.blocked.length > 0 && <span className="text-red-text">Блокеры: {mentee.blocked.length}</span>}
          {mentee.overdue > 0 && <span className="text-red-text">Просрочено: {mentee.overdue}</span>}
          {mentee.open_questions > 0 && <span>Вопросы: {mentee.open_questions}</span>}
          {mentee.open_requests > 0 && <span>Заявки: {mentee.open_requests}</span>}
          {attention === 0 && mentee.open_questions === 0 && <span>Всё идёт по плану</span>}
        </span>
      </Link>
    </li>
  );
}

function ReviewItem({ menteeId, item }: { menteeId: string; item: PlanItem }) {
  const review = useReviewItem();
  const [comment, setComment] = useState("");
  const reviewable = item.status === "waiting" && item.waiting_reason === "mentor_review";
  const mentorTask = item.audience === "mentor" && item.status !== "done";
  return (
    <li className="rounded-2xl bg-white p-4 shadow-[0_0_0_1px_rgba(0,0,0,0.06)]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="min-w-0 flex-1 basis-60 font-bold">{item.title}</p>
        <span className="flex flex-col items-end gap-1"><ItemStatusPill item={item} /><DueDate item={item} /></span>
      </div>
      {item.blocked_reason && <p className="mt-2 flex gap-2 rounded-xl bg-red-soft px-3 py-2 text-14"><AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />{item.blocked_reason}</p>}
      {reviewable && (
        <form className="mt-3 space-y-2" onSubmit={(event) => event.preventDefault()}>
          <input aria-label={`Комментарий к шагу «${item.title}»`} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Комментарий (обязателен при возврате)"
            className="h-9 w-full rounded-xl border border-[#d5d6dc] px-3 text-15 outline-none focus:border-blue" />
          <div className="flex flex-wrap gap-2">
            <button type="button" className={cx(action, actionTone.accent)} disabled={review.isPending}
              onClick={() => review.mutate({ mentee: menteeId, item: item.id, transition: "approve", comment: comment.trim() || undefined })}>
              <CheckCircle2 size={16} aria-hidden /> Подтвердить
            </button>
            <button type="button" className={cx(action, actionTone.secondary)} disabled={review.isPending || !comment.trim()}
              onClick={() => review.mutate({ mentee: menteeId, item: item.id, transition: "return", comment: comment.trim() })}>
              <Undo2 size={16} aria-hidden /> Вернуть
            </button>
          </div>
        </form>
      )}
      {mentorTask && (
        <button type="button" className={cx(action, actionTone.secondary, "mt-3")} disabled={review.isPending}
          onClick={() => review.mutate({ mentee: menteeId, item: item.id, transition: "complete" })}>
          <CheckCircle2 size={16} aria-hidden /> Сделано
        </button>
      )}
      {review.isError && <p role="alert" className="mt-2 text-14 text-red-text">{errorText(review.error)}</p>}
    </li>
  );
}

function MenteeDetail({ id }: { id: string }) {
  const { data, isPending, isError, error, refetch } = useMentee(id);
  if (isPending) return <Skeleton className="h-100" />;
  if (isError) return <LoadError error={error} onRetry={() => { void refetch(); }} />;
  const { summary, plan, requests } = data;
  const attention = [...summary.awaiting_review, ...summary.blocked];
  const overdue = plan.stages.flatMap((stage) => stage.items).filter((item) => item.overdue && item.status !== "done" && item.audience === "intern");
  return (
    <div className="space-y-6">
      <div className={cx(card, "space-y-3")}>
        <h2 className={heading.h2}>{summary.person.full_name}</h2>
        <p className={muted}>{summary.person.title} · {summary.person.email} · стажировка с {formatDay(summary.person.start_date)}</p>
        <div className="flex items-center gap-3">
          <span className="flex-1"><Progress percent={summary.percent} label="Прогресс плана" /></span>
          <span className="font-bold tabular-nums">{summary.done} из {summary.total}</span>
        </div>
        <p className="text-14">Этап «{plan.current_stage_title}». {plan.next_steps.length > 0 && `Дальше: ${plan.next_steps.map((step) => `«${step.title}»`).join(", ")}.`}</p>
      </div>
      <section aria-labelledby="review" className="space-y-3">
        <h3 id="review" className={heading.h3}>Требует внимания</h3>
        {attention.length === 0 && overdue.length === 0 ? <EmptyState>Ничего не ждёт твоего решения</EmptyState> : (
          <ul className="space-y-2">{[...attention, ...overdue.filter((item) => !attention.some((a) => a.id === item.id))].map((item) => <ReviewItem key={item.id} menteeId={id} item={item} />)}</ul>
        )}
      </section>
      {summary.mentor_tasks.length > 0 && (
        <section aria-labelledby="mentor-tasks" className="space-y-3">
          <h3 id="mentor-tasks" className={heading.h3}>Мои задачи наставника</h3>
          <ul className="space-y-2">{summary.mentor_tasks.map((item) => <ReviewItem key={item.id} menteeId={id} item={item} />)}</ul>
        </section>
      )}
      {requests.length > 0 && (
        <section aria-labelledby="mentee-requests" className="space-y-3">
          <h3 id="mentee-requests" className={heading.h3}>Заявки</h3>
          <ul className="space-y-2">
            {requests.map((request) => (
              <li key={request.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-fill px-4 py-3">
                {request.external_id && <span className="font-mono text-13 font-bold">{request.external_id}</span>}
                <span className="min-w-0 flex-1">{request.title}</span>
                <StatusPill status={request.status}>{request.status_title}</StatusPill>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function AnswerForm({ question, canPublish }: { question: Escalation; canPublish: boolean }) {
  const answer = useAnswerEscalation();
  const [text, setText] = useState("");
  const [publish, setPublish] = useState(canPublish);
  if (question.status !== "open") {
    return question.answer ? <p className="rounded-2xl bg-white px-4 py-3 whitespace-pre-wrap">{question.answer}</p> : null;
  }
  return (
    <form className="space-y-2" onSubmit={(event) => {
      event.preventDefault();
      if (text.trim().length >= 2) answer.mutate({ id: question.id, answer: text.trim(), publish: canPublish && publish });
    }}>
      <textarea aria-label={`Ответ на вопрос: ${question.question}`} rows={3} value={text} onChange={(event) => setText(event.target.value)} placeholder="Твой ответ стажёру"
        className="w-full resize-y rounded-2xl border border-[#d5d6dc] bg-white px-4 py-3 text-15 outline-none focus:border-blue" />
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className={cx(action, actionTone.accent)} disabled={answer.isPending || text.trim().length < 2}>Ответить</button>
        {canPublish && (
          <label className="inline-flex items-center gap-2 text-14">
            <input type="checkbox" className="size-4 accent-blue" checked={publish} onChange={(event) => setPublish(event.target.checked)} />
            Добавить в FAQ — Орби будет так отвечать другим стажёрам
          </label>
        )}
      </div>
      {answer.isError && <p role="alert" className="text-14 text-red-text">{errorText(answer.error)}</p>}
    </form>
  );
}

function Questions({ selected }: { selected?: string }) {
  const { data, isPending, isError, error, refetch } = useEscalations("assigned");
  const canPublish = usePermission("faq:publish");
  if (isPending) return <Skeleton className="h-50" />;
  if (isError) return <LoadError error={error} onRetry={() => { void refetch(); }} />;
  const open = data.filter((question) => question.status === "open");
  return (
    <section aria-labelledby="questions" className="space-y-3">
      <h2 id="questions" className={cx(heading.h2, "flex items-center gap-2")}><CircleHelp size={24} aria-hidden /> Вопросы стажёров{open.length ? ` · ${open.length}` : ""}</h2>
      {data.length === 0 ? <EmptyState>Новых вопросов нет</EmptyState> : (
        <ul className="space-y-3">
          {data.map((question) => (
            <li key={question.id} id={`question-${question.id}`} className={cx(card, "space-y-3", question.id === selected && "ring-2 ring-blue")}>
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill status={question.status === "open" ? "submitted" : "approved"}>{question.status === "open" ? "Ждёт ответа" : "Отвечен"}</StatusPill>
                <span className={muted}><UserRound size={13} className="mr-1 inline align-[-2px]" aria-hidden />{question.user_name} · {formatMoment(question.created_at)}</span>
                {question.status === "open" && <span className={cx("text-13", new Date(question.due_at) < new Date() ? "font-bold text-red-text" : "text-secondary")}>ответить до {formatMoment(question.due_at)}</span>}
              </div>
              <p className="text-16 font-bold leading-5.5">{question.question}</p>
              {typeof question.context.note === "string" && <p className={muted}>Контекст: {question.context.note}</p>}
              <AnswerForm question={question} canPublish={canPublish} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function MentorPage({ mentee, question }: { mentee?: string; question?: string }) {
  return (
    <RequireSession title="Мои стажёры">
      <MentorContent mentee={mentee} question={question} />
    </RequireSession>
  );
}

function MentorContent({ mentee, question }: { mentee?: string; question?: string }) {
  const allowed = usePermission("mentees:read");
  const { data, isPending, isError, error, refetch } = useMentees(allowed);
  return (
    <div className={cx(container, "flex flex-col gap-8")}>
      <div>
        <h1 className={heading.h1}>Мои стажёры</h1>
        <p className="mt-1.5 text-secondary">Прогресс, блокеры и шаги, которые ждут твоего подтверждения. Орби присылает сводку каждое утро.</p>
      </div>
      {!allowed ? <EmptyState>Экран наставника доступен наставникам, руководителям и HRBP</EmptyState> : isPending ? <Skeleton className="h-50" /> : isError ? (
        <LoadError error={error} onRetry={() => { void refetch(); }} />
      ) : (
        <div className="grid grid-cols-[minmax(0,380px)_minmax(0,1fr)] items-start gap-6 hub-max-900:grid-cols-1">
          <section aria-label="Стажёры" className="space-y-3">
            <p className={muted}>{plural(data.length, ["стажёр", "стажёра", "стажёров"])}</p>
            <ul className="space-y-3">{data.map((item) => <MenteeCard key={item.person.id} mentee={item} selected={item.person.id === mentee} />)}</ul>
          </section>
          <div className="space-y-8">
            {mentee ? <MenteeDetail id={mentee} /> : data.length > 0 && <EmptyState>Выбери стажёра слева, чтобы увидеть план и подтвердить шаги</EmptyState>}
            <Questions selected={question} />
          </div>
        </div>
      )}
    </div>
  );
}
