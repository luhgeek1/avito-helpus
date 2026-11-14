import { useState } from "react";
import { Bell, ChevronDown, CircleHelp, KeyRound, Laptop, Palmtree, Sparkles, X } from "lucide-react";
import { StatusPill, useOrbiChat } from "@/features/orbi-chat";
import { useAskMentor, useCloseEscalation, useEscalations, useRequestAction, useRequests } from "@/shared/api";
import type { Escalation, ServiceRequest } from "@/shared/api";
import { cx } from "@/shared/lib/cx";
import { formatMoment } from "@/shared/lib/orbi-format";
import { Link } from "@/shared/lib/portal-navigation";
import { container, EmptyState, heading, Skeleton } from "@/shared/ui/portal";
import { action, actionTone, card, errorText, LoadError, muted, RequireSession } from "./common";

const SOURCE: Record<string, string> = { user: "ты", agent: "Орби", worker: "система", webhook: "сервис", mentor: "наставник" };
const STATUS_NOTE: Record<string, string> = {
  submitting: "Отправляем в сервис", submitted: "На согласовании", approved: "Одобрено", rejected: "Отклонено",
  failed: "Не удалось отправить", cancelled: "Отменено",
};
const KIND_ICON: Record<string, typeof KeyRound> = { access: KeyRound, absence: Palmtree, equipment: Laptop };

const QUICK = [
  { label: "Доступ", phrase: "Нужен доступ к сервису", icon: KeyRound },
  { label: "Отгул", phrase: "Хочу взять отгул", icon: Palmtree },
  { label: "Обращение в IT", phrase: "Нужна помощь IT-поддержки", icon: Laptop },
];

function RequestCard({ request, selected }: { request: ServiceRequest; selected: boolean }) {
  const [open, setOpen] = useState(selected);
  const mutation = useRequestAction();
  const Icon = KIND_ICON[request.kind] ?? KeyRound;
  const active = request.status === "submitted" || request.status === "submitting";
  return (
    <li className={cx(card, selected && "ring-2 ring-blue")} id={`request-${request.id}`}>
      <button type="button" className="flex w-full items-start gap-4 text-left" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white"><Icon size={20} aria-hidden /></span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            {request.external_id && <span className="font-mono text-13 font-bold">{request.external_id}</span>}
            <StatusPill status={request.status}>{request.status_title}</StatusPill>
          </span>
          <span className="mt-1 block text-16 font-bold leading-5.5">{request.title}</span>
          <span className={cx(muted, "mt-0.5 block")}>
            {request.approver ? `Согласует: ${request.approver}` : "Согласующий не нужен"}
            {request.sla_due_at && request.status === "submitted" ? ` · ответ до ${formatMoment(request.sla_due_at)}` : ""}
          </span>
        </span>
        <ChevronDown size={20} aria-hidden className={cx("mt-2 shrink-0 transition-transform duration-200 motion-reduce:transition-none", open && "rotate-180")} />
      </button>
      {open && (
        <div className="mt-4 space-y-4 pl-15 hub-max-720:pl-0">
          {request.decision_comment && <p className="rounded-2xl bg-white px-4 py-3">{request.decision_comment}</p>}
          <ol className="space-y-2 border-l-2 border-divider pl-4" aria-label="История заявки">
            {request.history.map((event, index) => (
              <li key={`${event.created_at}-${index}`} className="relative">
                <span className="absolute top-1.5 -left-[21px] size-2 rounded-full bg-dark" aria-hidden />
                <p className="text-14"><strong className="font-bold">{STATUS_NOTE[event.status] ?? event.status}</strong> · {SOURCE[event.source] ?? event.source}</p>
                <p className={muted}>{formatMoment(event.created_at)}{event.note ? ` · ${event.note}` : ""}</p>
              </li>
            ))}
          </ol>
          {active && (
            <div className="flex flex-wrap gap-2">
              {request.status === "submitted" && request.approver && (
                <button type="button" className={cx(action, actionTone.white)} disabled={mutation.isPending}
                  onClick={() => mutation.mutate({ id: request.id, action: "remind" })}>
                  <Bell size={15} aria-hidden /> Напомнить согласующему
                </button>
              )}
              <button type="button" className={cx(action, actionTone.ghost)} disabled={mutation.isPending}
                onClick={() => mutation.mutate({ id: request.id, action: "cancel" })}>
                <X size={15} aria-hidden /> Отменить заявку
              </button>
            </div>
          )}
          {mutation.isSuccess && mutation.variables.action === "remind" && <p role="status" className="text-14 text-green-text">Напомнили согласующему</p>}
          {mutation.isError && <p role="alert" className="text-14 text-red-text">{errorText(mutation.error)}</p>}
        </div>
      )}
    </li>
  );
}

function RequestsList({ selected }: { selected?: string }) {
  const { data, isPending, isError, error, refetch } = useRequests();
  const ask = useOrbiChat((state) => state.ask);
  if (isPending) return <Skeleton height={240} />;
  if (isError) return <LoadError error={error} onRetry={() => { void refetch(); }} />;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cx(muted, "mr-1")}>Новая заявка через Орби:</span>
        {QUICK.map(({ label, phrase, icon: Icon }) => (
          <button key={label} type="button" className={cx(action, actionTone.secondary)} onClick={() => ask(phrase)}>
            <Icon size={15} aria-hidden /> {label}
          </button>
        ))}
      </div>
      {data.length === 0 ? (
        <EmptyState>Заявок пока нет. Напиши Орби, например: «Нужен доступ к Grafana» — он подготовит карточку и отправит её после подтверждения.</EmptyState>
      ) : (
        <ul className="space-y-3">{data.map((request) => <RequestCard key={request.id} request={request} selected={request.id === selected} />)}</ul>
      )}
    </div>
  );
}

const ESCALATION_STATUS: Record<string, { title: string; status: string }> = {
  open: { title: "Ждёт ответа", status: "submitted" }, answered: { title: "Есть ответ", status: "approved" },
  closed: { title: "Закрыт", status: "cancelled" },
};
const LEVEL: Record<string, string> = { mentor: "наставник", lead: "руководитель", hrbp: "HRBP" };

function QuestionCard({ question, selected }: { question: Escalation; selected: boolean }) {
  const close = useCloseEscalation();
  const status = ESCALATION_STATUS[question.status] ?? { title: question.status, status: "submitted" };
  return (
    <li className={cx(card, "space-y-3", selected && "ring-2 ring-blue")} id={`question-${question.id}`}>
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill status={status.status}>{status.title}</StatusPill>
        <span className={muted}>{question.assignee_name} ({LEVEL[question.level] ?? question.level}) · {formatMoment(question.created_at)}</span>
      </div>
      <p className="text-16 font-bold leading-5.5">{question.question}</p>
      {question.answer ? (
        <div className="rounded-2xl bg-white px-4 py-3">
          <p className="mb-1 text-13 text-secondary">{question.answered_by_name ?? question.assignee_name} ответил {formatMoment(question.answered_at)}</p>
          <p className="whitespace-pre-wrap">{question.answer}</p>
          {question.faq_document_slug && <p className="mt-2 text-13 text-green-text">Ответ добавлен в FAQ — Орби будет отвечать так другим стажёрам</p>}
        </div>
      ) : question.status === "open" ? (
        <p className={muted}>Ответ ожидается до {formatMoment(question.due_at)}. Если наставник не успеет, вопрос поднимется к руководителю.</p>
      ) : null}
      {question.status !== "closed" && (
        <button type="button" className={cx(action, actionTone.ghost)} disabled={close.isPending} onClick={() => close.mutate(question.id)}>
          {question.answer ? "Спасибо, закрыть" : "Вопрос больше не актуален"}
        </button>
      )}
      {close.isError && <p role="alert" className="text-14 text-red-text">{errorText(close.error)}</p>}
    </li>
  );
}

function QuestionsList({ selected }: { selected?: string }) {
  const { data, isPending, isError, error, refetch } = useEscalations("mine");
  const askMentor = useAskMentor();
  const [question, setQuestion] = useState("");
  if (isPending) return <Skeleton height={240} />;
  if (isError) return <LoadError error={error} onRetry={() => { void refetch(); }} />;
  return (
    <div className="space-y-5">
      <form className={cx(card, "space-y-3")} onSubmit={(event) => {
        event.preventDefault();
        if (question.trim().length >= 5) askMentor.mutate(question.trim(), { onSuccess: () => setQuestion("") });
      }}>
        <label className="block">
          <span className="mb-2 block font-bold">Спросить наставника напрямую</span>
          <textarea value={question} onChange={(event) => setQuestion(event.target.value)} rows={2} placeholder="Например: как правильно называть ветки?"
            className="w-full resize-y rounded-2xl border border-[#d5d6dc] bg-white px-4 py-3 text-15 outline-none focus:border-blue" />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className={cx(action, actionTone.accent)} disabled={askMentor.isPending || question.trim().length < 5}>Отправить вопрос</button>
          <span className={muted}>Деликатный вопрос лучше задать через Орби — он передаст его HRBP.</span>
        </div>
        {askMentor.isSuccess && <p role="status" className="text-14 text-green-text">Вопрос передан: {askMentor.data.assignee_name}</p>}
        {askMentor.isError && <p role="alert" className="text-14 text-red-text">{errorText(askMentor.error)}</p>}
      </form>
      {data.length === 0 ? <EmptyState>Вопросов пока нет. Если Орби не найдёт ответ, он предложит передать вопрос наставнику.</EmptyState> : (
        <ul className="space-y-3">{data.map((item) => <QuestionCard key={item.id} question={item} selected={item.id === selected} />)}</ul>
      )}
    </div>
  );
}

export function RequestsPage({ tab = "requests", selected }: { tab?: "requests" | "questions"; selected?: string }) {
  return (
    <RequireSession title="Заявки и вопросы">
      <div className={cx(container, "flex flex-col gap-6")}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className={heading.h1}>Заявки и вопросы</h1>
            <p className="mt-1.5 text-secondary">Всё, что Орби отправил за тебя, со статусами из корпоративных сервисов</p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-13 text-secondary"><Sparkles size={15} aria-hidden /> Статусы обновляются сами</span>
        </div>
        <nav className="flex gap-2" aria-label="Разделы">
          <Link to="/requests" aria-current={tab === "requests" ? "page" : undefined}
            className={cx(action, tab === "requests" ? actionTone.primary : actionTone.secondary)}><KeyRound size={15} aria-hidden /> Заявки</Link>
          <Link to="/questions" aria-current={tab === "questions" ? "page" : undefined}
            className={cx(action, tab === "questions" ? actionTone.primary : actionTone.secondary)}><CircleHelp size={15} aria-hidden /> Мои вопросы</Link>
        </nav>
        {tab === "requests" ? <RequestsList selected={selected} /> : <QuestionsList selected={selected} />}
      </div>
    </RequireSession>
  );
}
