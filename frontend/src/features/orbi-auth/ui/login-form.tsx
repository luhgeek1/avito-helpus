import { useState } from "react";
import type { FormEvent } from "react";
import { LogIn } from "lucide-react";
import { OrbiError, useSession } from "@/shared/api";
import { cx } from "@/shared/lib/cx";

export const DEMO_PASSWORD = "orbi-demo-2026";

export const DEMO_ACCOUNTS = [
  { email: "anya.intern@buddy.test", name: "Аня Смирнова", role: "Стажёр, 3-й день", hint: "основной сценарий: план, доступы, отгул, ноутбук" },
  { email: "kirill.intern@buddy.test", name: "Кирилл Орлов", role: "Стажёр, 17-й день", hint: "блокер, шаг на ревью, вопрос без ответа" },
  { email: "dana.intern@buddy.test", name: "Дана Ли", role: "Стажёр, «Платежи»", hint: "другая команда: не видит чужие документы" },
  { email: "ivan.mentor@buddy.test", name: "Иван Петров", role: "Наставник", hint: "экран наставника, ответы, FAQ" },
  { email: "maria.lead@buddy.test", name: "Мария Ким", role: "Руководитель", hint: "стажёры команды, метрики" },
  { email: "olga.hrbp@buddy.test", name: "Ольга Соколова", role: "HRBP", hint: "деликатные вопросы, все стажёры" },
] as const;

const field = "h-12 w-full rounded-xl border border-[#d5d6dc] bg-white px-4 text-16 text-primary outline-none transition-shadow focus:border-blue focus:ring-3 focus:ring-focus/40";

function message(error: unknown): string {
  if (error instanceof OrbiError) {
    if (error.status === 401) return "Неверная почта или пароль";
    if (error.status === 429) return "Слишком много попыток. Подожди минуту";
    if (error.status === 0) return "Сервер Орби недоступен. Запущен ли бэкенд?";
  }
  return "Не удалось войти. Попробуй ещё раз";
}

export function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const login = useSession((state) => state.login);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function enter(address: string, secret: string) {
    setPending(address);
    setError(null);
    try {
      await login(address.trim(), secret);
      onSuccess();
    } catch (reason) {
      setError(message(reason));
    } finally {
      setPending(null);
    }
  }

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (email.trim() && password) void enter(email, password);
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      <form onSubmit={submit} className="space-y-3" aria-label="Вход в Хаб">
        <label className="block">
          <span className="mb-1.5 block text-13 text-secondary">Рабочая почта</span>
          <input className={field} type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)}
            placeholder="name@buddy.test" required />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-13 text-secondary">Пароль</span>
          <input className={field} type="password" autoComplete="current-password" value={password}
            onChange={(event) => setPassword(event.target.value)} required />
        </label>
        {error && <p role="alert" className="rounded-xl bg-red-soft px-4 py-3 text-14">{error}</p>}
        <button type="submit" disabled={pending !== null}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue text-16 font-bold text-white transition-colors hover:bg-blue-hover active:bg-blue-pressed disabled:opacity-60">
          <LogIn size={18} aria-hidden /> {pending === email.trim() ? "Входим…" : "Войти"}
        </button>
        <p className="text-13 text-secondary">В Авито вход идёт через корпоративный SSO. Здесь — демо-учётки с паролем <code className="rounded bg-control px-1">{DEMO_PASSWORD}</code>.</p>
      </form>
      <section aria-labelledby="demo-accounts">
        <h2 id="demo-accounts" className="mb-3 text-18 font-bold">Войти как</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {DEMO_ACCOUNTS.map((account) => (
            <li key={account.email}>
              <button type="button" disabled={pending !== null} onClick={() => { void enter(account.email, DEMO_PASSWORD); }}
                className={cx("flex h-full w-full flex-col items-start gap-0.5 rounded-2xl bg-control px-4 py-3 text-left transition-colors hover:bg-control-hover disabled:opacity-60",
                  pending === account.email && "ring-2 ring-blue")}>
                <span className="font-bold">{account.name}</span>
                <span className="text-13 text-primary">{account.role}</span>
                <span className="text-12 text-secondary">{account.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
