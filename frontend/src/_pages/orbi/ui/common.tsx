import type { ReactNode } from "react";
import { LogIn } from "lucide-react";
import { OrbiError, useKnowledgeDocument, useSession } from "@/shared/api";
import type { PlanItem } from "@/shared/api";
import { cx } from "@/shared/lib/cx";
import { formatDay } from "@/shared/lib/orbi-format";
import { Link } from "@/shared/lib/portal-navigation";
import { container, ErrorState, heading, Modal, Skeleton } from "@/shared/ui/portal";

export const card = "rounded-3xl bg-fill p-5 hub-max-720:p-4";
export const muted = "text-13 text-secondary";
export const pill = "inline-flex h-6 items-center rounded-lg px-2 text-12 font-bold";
export const action = "inline-flex h-9 items-center justify-center gap-1.5 rounded-xl px-3.5 text-14 font-bold transition-colors duration-150 disabled:cursor-default disabled:opacity-50";
export const actionTone = {
  accent: "bg-blue text-white hover:bg-blue-hover active:bg-blue-pressed",
  primary: "bg-dark text-white hover:bg-dark-hover",
  secondary: "bg-control text-primary hover:bg-control-hover",
  white: "bg-white text-primary hover:bg-control",
  ghost: "bg-transparent text-secondary hover:bg-fill hover:text-primary",
};

/** Screens of the real Orbi backend need a signed-in user; the portal itself stays open. */
export function RequireSession({ title, children }: { title: string; children: ReactNode }) {
  const status = useSession((state) => state.status);
  if (status === "authenticated") return children;
  return (
    <div className={cx(container, "flex flex-col gap-6")}>
      <h1 className={heading.h1}>{title}</h1>
      {status === "unknown" ? <Skeleton height={180} /> : (
        <div className={cx(card, "flex flex-wrap items-center justify-between gap-4")}>
          <p className="max-w-130 text-16 leading-6">Раздел работает с твоими данными: войди под рабочей учёткой, и Орби покажет план, заявки и вопросы.</p>
          <Link to="/login" className={cx(action, actionTone.accent, "h-11 px-5")}><LogIn size={18} aria-hidden /> Войти</Link>
        </div>
      )}
    </div>
  );
}

export function LoadError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const message = error instanceof OrbiError && error.status === 403 ? "Этот раздел недоступен для твоей роли" : "Не удалось загрузить данные";
  return <ErrorState message={message} onRetry={onRetry} />;
}

export function Progress({ percent, label, tone = "bg-green" }: { percent: number; label: string; tone?: string }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-white" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className={cx("h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none", tone)} style={{ width: `${Math.max(percent, percent > 0 ? 3 : 0)}%` }} />
    </div>
  );
}

const STATUS: Record<PlanItem["status"], { title: string; tone: string }> = {
  todo: { title: "Нужно сделать", tone: "bg-white text-secondary" },
  in_progress: { title: "В работе", tone: "bg-blue-soft text-blue-text" },
  waiting: { title: "Ждёт", tone: "bg-purple-soft text-purple-text" },
  blocked: { title: "Блокер", tone: "bg-red-soft text-red-text" },
  done: { title: "Готово", tone: "bg-green-soft text-green-text" },
};

export function itemStatus(item: PlanItem): { title: string; tone: string } {
  if (item.status === "waiting") return { title: item.waiting_reason === "mentor_review" ? "На проверке" : "Ждёт заявку", tone: STATUS.waiting.tone };
  if (item.overdue && item.status !== "done") return { title: "Просрочено", tone: "bg-red-soft text-red-text" };
  return STATUS[item.status];
}

export function ItemStatusPill({ item }: { item: PlanItem }) {
  const status = itemStatus(item);
  return <span className={cx(pill, status.tone)}>{status.title}</span>;
}

export function DueDate({ item }: { item: PlanItem }) {
  if (item.status === "done") return <span className={muted}>выполнено {formatDay(item.completed_at)}</span>;
  return <span className={cx("text-13", item.overdue ? "font-bold text-red-text" : "text-secondary")}>до {formatDay(item.due_date)}</span>;
}

/** Markdown-ish knowledge base article: headings, lists and paragraphs, no HTML. */
export function DocumentBody({ body }: { body: string }) {
  return (
    <div className="space-y-3 text-15 leading-6">
      {body.split(/\n{2,}/).map((block, index) => {
        const key = `${index}`;
        if (block.startsWith("<!--")) return null;
        const headingMatch = /^(#{1,3})\s+(.*)$/.exec(block);
        if (headingMatch) return <h3 key={key} className={cx("font-bold", headingMatch[1].length === 1 ? "text-20" : "text-17")}>{headingMatch[2]}</h3>;
        const lines = block.split("\n");
        if (lines.every((line) => /^\s*([-*]|\d+\.)\s+/.test(line))) {
          return <ul key={key} className="list-disc space-y-1 pl-5">{lines.map((line, i) => <li key={`${key}-${i}`}>{line.replace(/^\s*([-*]|\d+\.)\s+/, "").replace(/\*\*/g, "")}</li>)}</ul>;
        }
        return <p key={key} className="whitespace-pre-wrap">{block.replace(/\*\*/g, "")}</p>;
      })}
    </div>
  );
}

export function DocumentModal({ slug, onClose }: { slug: string; onClose: () => void }) {
  const { data, isPending, isError, refetch } = useKnowledgeDocument(slug);
  return (
    <Modal title={data?.title ?? "Инструкция"} onClose={onClose} wide>
      {isPending ? <Skeleton height={200} /> : isError ? <ErrorState onRetry={() => { void refetch(); }} /> : (
        <div className="space-y-4">
          <p className={muted}>{data.source_label} · {data.team_name ?? "вся компания"} · обновлено {formatDay(data.updated_at)}</p>
          <DocumentBody body={data.body} />
        </div>
      )}
    </Modal>
  );
}

const ERROR_TEXT: Record<string, string> = {
  PLAN_QUIZ_REQUIRED: "Сначала пройди мини-тест по шагу",
  PLAN_REVIEW_REQUIRED: "Этот шаг подтверждает наставник — отправь его на проверку",
  PLAN_TRANSITION_INVALID: "Статус шага уже изменился. Обнови страницу",
  REQUEST_TRANSITION_INVALID: "Заявку уже нельзя изменить",
  REMIND_TOO_SOON: "Напоминание уже отправляли недавно. Попробуй позже",
  ESCALATION_CLOSED: "Вопрос уже закрыт",
  FORBIDDEN: "Недостаточно прав",
  CORP_SERVICE_UNAVAILABLE: "Корпоративный сервис временно недоступен. Попробуй через минуту",
  RATE_LIMITED: "Слишком много запросов. Подожди минуту",
  NETWORK: "Нет соединения с сервером",
};

export function errorText(error: unknown): string {
  if (error instanceof OrbiError) return ERROR_TEXT[error.code] ?? "Не получилось. Попробуй ещё раз";
  return "Не получилось. Попробуй ещё раз";
}
