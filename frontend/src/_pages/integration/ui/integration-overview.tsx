import Link from "next/link";
import { ArrowDown, ArrowUpRight, Check, Layers3, MessageCircle, Plug, ShieldCheck } from "lucide-react";
import { integrationSnippets } from "@/shared/config";
import { cx } from "@/shared/lib/cx";
import { CodeBlock } from "@/shared/ui/code-block";
import { action } from "./integration-ui";

export function IntegrationOverview() {
  return (
        <section id="overview" className="scroll-mt-28 pb-10 pt-9 sm:pb-12 sm:pt-12">
          <div className="mb-6 flex flex-wrap items-center gap-2 text-11 text-[#72798a]">
            <span className="flex items-center gap-1.5 rounded-full border border-[#e6dfef] bg-[#f7f3fc] px-2.5 py-1 text-[#705a9e]"><span className="size-1.5 rounded-full bg-[#8d77b4]" />React-библиотека</span>
            <span>React / Next.js</span><span aria-hidden>·</span><span>REST + SSE</span>
          </div>
          <h1 className="max-w-180 text-35 font-semibold leading-[1.13] tracking-[-1.4px] sm:text-42 lg:text-[52px]">Ваша платформа.<br />Напарник — Орби.</h1>
          <p className="mt-5 max-w-155 text-15 leading-7 text-[#6b7282] sm:text-16">Поселите AI-спутника в своём интерфейсе. Он поможет новичкам освоиться, найдёт ответы и доведёт заявку до результата.</p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <a href="#quickstart" className={cx(action, "bg-[#76609f] text-white hover:bg-[#634d8d]")}>Начать интеграцию<ArrowDown size={15} aria-hidden /></a>
            <Link href="/demo" className={cx(action, "border border-line bg-white text-[#5e6574] hover:bg-canvas")}>Посмотреть демо<ArrowUpRight size={15} aria-hidden /></Link>
          </div>

          <div className="mt-9 grid min-w-0 gap-0 overflow-hidden rounded-2xl border border-[#e7e2ee] bg-[#f7f5fb] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
            <div className="flex flex-col justify-between px-5 py-6 sm:p-6">
              <div>
                <span className="mb-4 inline-flex items-center gap-2 text-11 font-medium text-[#80718f]"><Plug size={15} aria-hidden />Один спутник. Вся платформа.</span>
                <h2 className="text-20 font-semibold leading-7 tracking-[-0.4px]">Ваш интерфейс остаётся вашим</h2>
                <p className="mt-3 text-13 leading-6 text-[#727183]">Орби живёт поверх страниц. Чат, гардероб и уведомления доступны там, где человек уже работает.</p>
              </div>
              <p className="mt-5 flex items-center gap-2 text-11 text-[#81788d]"><Check size={14} aria-hidden />Без переноса портала «Хаб»</p>
            </div>
            <CodeBlock code={integrationSnippets.component} language="tsx" title="Ваш постоянный layout" className="rounded-none border-0" />
          </div>
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-12 text-[#72798a]">
            {[{ Icon: MessageCircle, text: "Чат и Spotlight" }, { Icon: Layers3, text: "Знания и действия" }, { Icon: ShieldCheck, text: "Права и подтверждения" }].map(({ Icon, text }) => <span key={text} className="inline-flex items-center gap-2"><Icon size={15} className="text-[#9487a7]" aria-hidden />{text}</span>)}
          </div>
        </section>
  );
}
