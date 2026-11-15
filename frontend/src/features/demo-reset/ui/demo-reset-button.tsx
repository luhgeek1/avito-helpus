import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { OrbiError, orbiFetch, useSession } from "@/shared/api";
import { cx } from "@/shared/lib/cx";

type Step = "idle" | "confirm" | "pending" | "failed";
const labels: Record<Step, string> = {
  idle: "Сбросить демо", confirm: "Точно сбросить?", pending: "Сбрасываю…", failed: "Не получилось",
};

function reason(error: unknown) {
  if (error instanceof OrbiError && error.status === 404) return "Сброс выключен на этом стенде";
  return error instanceof OrbiError ? error.detail : "Сброс не удался";
}

/** Restores the synthetic company for everyone, so the second click confirms it. */
export function DemoResetButton() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState("");
  useEffect(() => {
    if (step !== "confirm" && step !== "failed") return;
    const timer = setTimeout(() => setStep("idle"), 5000);
    return () => clearTimeout(timer);
  }, [step]);

  async function reset() {
    if (step !== "confirm") { setStep("confirm"); return; }
    setStep("pending");
    try {
      await orbiFetch("/demo/reset", { method: "POST", auth: false });
    } catch (problem) {
      setError(reason(problem));
      setStep("failed");
      return;
    }
    // Every account was recreated: sign out here and start from the login screen.
    await useSession.getState().logout();
    setStep("idle");
    router.push("/login");
  }

  return <>
    <button type="button" onClick={() => void reset()} disabled={step === "pending"}
      title={step === "failed" ? error : "Вернуть демо-компанию в исходное состояние для всех"}
      className={cx("flex min-h-12.5 shrink-0 items-center gap-2 rounded-xl border border-line bg-white px-3 text-12 font-medium text-[#676c7b] transition-colors hover:text-ink disabled:cursor-default motion-reduce:transition-none max-sm:px-4",
        step === "confirm" && "border-red bg-red-soft text-red-text hover:text-red-text", step === "failed" && "text-red-text")}>
      <RotateCcw size={14} aria-hidden className={cx(step === "pending" && "motion-safe:animate-spin")} />
      <span className="max-sm:sr-only">{labels[step]}</span>
    </button>
    <span role="status" className="sr-only">{step === "failed" ? error : step === "pending" ? "Сбрасываю демо" : ""}</span>
  </>;
}
