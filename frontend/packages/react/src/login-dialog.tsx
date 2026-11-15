import { useEffect, useRef, useState } from "react";
import { useLoginDialog } from "./navigation";
import { useSession } from "./session";

/** Cookie-mode sign-in stays inside the widget; no host /login route is required. */
export function LoginDialog() {
  const { open, show } = useLoginDialog();
  const dialog = useRef<HTMLDialogElement>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) dialog.current?.showModal(); else dialog.current?.close(); }, [open]);
  if (!open) return null;
  return <dialog ref={dialog} aria-labelledby="orbi-login-title" onCancel={() => show(false)}
    className="m-auto w-[min(420px,calc(100vw-32px))] rounded-2xl border border-line bg-white p-6 font-sans text-14 text-ink shadow-pop backdrop:bg-dark/40">
    <h2 id="orbi-login-title" className="mb-4 text-21 font-semibold">Войти в Орби</h2>
    <form className="grid gap-4" onSubmit={async (event) => {
      event.preventDefault(); setBusy(true); setError("");
      try { await useSession.getState().login(email, password); setPassword(""); show(false); }
      catch { setError("Не удалось войти. Проверь почту, пароль и доступность сервера."); }
      finally { setBusy(false); }
    }}>
      <label className="grid gap-1">Рабочая почта<input type="email" required autoComplete="username" value={email}
        onChange={(event) => setEmail(event.target.value)} className="h-11 rounded-lg border border-line px-3 text-16" /></label>
      <label className="grid gap-1">Пароль<input type="password" required autoComplete="current-password" value={password}
        onChange={(event) => setPassword(event.target.value)} className="h-11 rounded-lg border border-line px-3 text-16" /></label>
      {error && <p role="alert" className="text-red-text">{error}</p>}
      <button disabled={busy} className="h-11 rounded-xl bg-blue font-semibold text-white disabled:opacity-50">{busy ? "Входим…" : "Войти"}</button>
      <button type="button" onClick={() => show(false)} className="h-11 rounded-xl bg-control">Закрыть</button>
    </form>
  </dialog>;
}
