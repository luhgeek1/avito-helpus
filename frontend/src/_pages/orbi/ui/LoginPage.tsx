import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { LoginForm } from "@/features/orbi-auth";
import { meQuery, useSession } from "@/shared/api";
import { cx } from "@/shared/lib/cx";
import { useNavigate } from "@/shared/lib/portal-navigation";
import { container, heading } from "@/shared/ui/portal";

const STAFF = new Set(["mentor", "lead", "hrbp"]);

/** After sign-in an intern lands on their path, a mentor on the mentees screen. */
export function LoginPage({ next }: { next?: string }) {
  const navigate = useNavigate();
  const client = useQueryClient();
  const status = useSession((state) => state.status);
  const target = next?.startsWith("/") && !next.startsWith("//") ? next : undefined;

  async function land() {
    if (target) { navigate({ to: target }); return; }
    try {
      const me = await client.fetchQuery(meQuery);
      navigate({ to: STAFF.has(me.role) ? "/mentor" : me.role === "admin" ? "/" : "/plan" });
    } catch {
      navigate({ to: "/plan" });
    }
  }

  useEffect(() => { if (status === "authenticated" && target) navigate({ to: target, replace: true }); }, [status, target, navigate]);

  return (
    <div className={cx(container, "flex flex-col gap-8")}>
      <div>
        <h1 className={heading.h1}>Вход в Хаб</h1>
        <p className="mt-1.5 max-w-150 text-secondary">Орби — AI-напарник стажёра: ведёт план адаптации, отвечает по базе знаний со ссылками и оформляет заявки после твоего подтверждения.</p>
      </div>
      {status === "authenticated" && !target && (
        <p role="status" className="rounded-2xl bg-green-soft px-4 py-3">Ты уже вошёл. Можно выбрать другую учётку ниже.</p>
      )}
      <LoginForm onSuccess={() => { void land(); }} />
    </div>
  );
}
