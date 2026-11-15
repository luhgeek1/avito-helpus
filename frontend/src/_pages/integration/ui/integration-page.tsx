"use client";

import Link from "next/link";
import { ArrowRight, MessageCircle } from "lucide-react";
import { useIntegrationAssistant } from "@/features/integration-assistant";
import { cx } from "@/shared/lib/cx";
import { IntegrationLayout } from "./integration-layout";
import { IntegrationOverview } from "./integration-overview";
import { IntegrationSteps } from "./integration-steps";
import { action } from "./integration-ui";

export function IntegrationPage() {
  const ask = useIntegrationAssistant((state) => state.ask);
  return <IntegrationLayout>
    <IntegrationOverview />
    <IntegrationSteps />
        <div className="flex flex-col gap-5 rounded-2xl bg-[#f4f0f9] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
          <div><h2 className="text-20 font-semibold tracking-[-0.4px]">Установка — тоже с напарником</h2><p className="mt-2 max-w-100 text-13 leading-6 text-[#7a7188]">Орби уже рядом. Спросите про любой шаг — он найдёт нужный раздел и покажет пример.</p></div>
          <button type="button" onClick={() => ask("С чего начать установку Орби?")} className={cx(action, "shrink-0 bg-white text-[#6a55a4] hover:bg-[#eae3f3]")}>Спросить Орби<MessageCircle size={16} aria-hidden /></button>
        </div>
        <footer className="mt-9 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6 text-11 text-[#9296a1]">
          <span>Орби, Hack&Change 2026</span><Link href="/demo" className="inline-flex min-h-11 items-center gap-2 text-[#786a8e]">Перейти в демо<ArrowRight size={14} aria-hidden /></Link>
        </footer>
  </IntegrationLayout>;
}
