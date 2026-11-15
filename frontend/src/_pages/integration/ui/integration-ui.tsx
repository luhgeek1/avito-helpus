import type { ReactNode } from "react";
import { ArrowUpRight, MessageCircle } from "lucide-react";
import { useIntegrationAssistant } from "@/features/integration-assistant";
import { cx } from "@/shared/lib/cx";

export const action = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-13 font-medium transition-colors motion-reduce:transition-none";
export const paragraph = "text-14 leading-7 text-[#646b7a]";

export function InlineCode({ children }: { children: ReactNode }) {
  return <code className="break-words rounded-md border border-line bg-[#f5f6f9] px-1.5 py-0.5 font-mono text-[0.88em] text-[#5e4b9b]">{children}</code>;
}

export function Section({ id, step, title, description, children }: { id: string; step: string; title: string; description: string; children: ReactNode }) {
  return <section id={id} className="scroll-mt-28 border-t border-line py-10 sm:py-14">
    <div className="mb-6 flex items-start gap-3 sm:gap-4">
      <span className="mt-1 grid size-8 shrink-0 place-items-center rounded-lg border border-[#e3dced] bg-[#f4f0fa] font-mono text-12 text-[#7760a8]">{step}</span>
      <div><h2 className="text-23 font-semibold leading-8 tracking-[-0.5px] sm:text-26">{title}</h2><p className={cx(paragraph, "mt-1")}>{description}</p></div>
    </div>
    <div className="space-y-5">{children}</div>
  </section>;
}

export function HelpLink({ question, children }: { question: string; children: ReactNode }) {
  const ask = useIntegrationAssistant((state) => state.ask);
  return <button type="button" onClick={() => ask(question)} className="inline-flex min-h-11 items-center gap-2 text-left text-13 font-medium text-[#6a55a4] hover:text-[#493875]">
    <MessageCircle size={15} aria-hidden />{children}<ArrowUpRight size={13} aria-hidden />
  </button>;
}
