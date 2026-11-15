import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { OrbiError, orbiFetch, useSession } from "@/shared/api";
import { cx } from "@/shared/lib/cx";
import { buttonClass } from "@/shared/ui/portal";

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
      className={cx(buttonClass(step === "confirm" ? "primary" : "secondary", "s"),
        "relative shrink-0 font-portal motion-reduce:transition-none max-sm:w-9 max-sm:px-0",
        // A transparent rim widens the 36px button to a 44px touch target.
        "after:absolute after:-inset-1 after:rounded-2xl after:content-['']", step === "failed" && "text-red-text")}>
      <RotateCcw size={16} aria-hidden className={cx(step === "pending" && "motion-safe:animate-spin")} />
      <span className="max-sm:sr-only">{labels[step]}</span>
    </button>
    <span role="status" className="sr-only">{step === "failed" ? error : step === "pending" ? "Сбрасываю демо" : ""}</span>
  </>;
}
