import Link from "next/link";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ArrowUpRight, BookOpen, ChevronDown, CircleHelp } from "lucide-react";
import { PixelPet, defaultPet } from "@/entities/pet";
import { useIntegrationAssistant } from "@/features/integration-assistant";
import { integrationSections } from "@/shared/config";
import { cx } from "@/shared/lib/cx";
import { ExperienceBar } from "@/shared/ui/experience-switcher";

export function IntegrationLayout({ children }: { children: ReactNode }) {
  const [active, setActive] = useState("overview");
  const ask = useIntegrationAssistant((state) => state.ask);
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setActive(visible[0].target.id);
    }, { rootMargin: "-100px 0px -55% 0px", threshold: 0 });
    integrationSections.forEach(({ id }) => { const section = document.getElementById(id); if (section) observer.observe(section); });
    return () => observer.disconnect();
  }, []);

  return <div className="min-h-screen bg-white text-ink">
    <a href="#integration-main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-100 focus:rounded-xl focus:bg-white focus:p-4">К содержимому</a>
    <header className="sticky top-0 z-30 border-b border-line bg-white">
      <ExperienceBar>
        <Link href="/" aria-label="Орби — руководство по интеграции" className="flex items-center gap-2.5">
          <span className="grid size-10 place-items-center rounded-xl bg-[#f1edf8]"><PixelPet pet={defaultPet} size={32} paused /></span>
          <span className="text-22 font-semibold tracking-[-0.7px]">Орби<span className="ml-3 hidden border-l border-line pl-3 text-12 font-normal tracking-normal text-[#747986] sm:inline">для разработчиков</span></span>
        </Link>
      </ExperienceBar>
    </header>

    <div className="mx-auto grid max-w-340 md:grid-cols-[212px_minmax(0,1fr)] lg:grid-cols-[244px_minmax(0,1fr)]">
      <aside className="border-b border-line bg-[#fafbfc] md:sticky md:top-20 md:h-[calc(100dvh-80px)] md:border-b-0 md:border-r">
        <div className="flex h-full flex-col px-5 py-4 sm:px-9 md:px-5 md:py-10 lg:px-7">
          <p className="mb-4 hidden text-11 font-semibold tracking-[0.08em] text-[#858997] md:block">РУКОВОДСТВО</p>
          <nav aria-label="Разделы интеграции" className="hidden space-y-1 md:block">
            {integrationSections.map(({ id, title }, index) => <a key={id} href={`#${id}`} onClick={() => setActive(id)} aria-current={active === id ? "location" : undefined}
              className={cx("flex min-h-11 items-center gap-2.5 rounded-lg px-3 text-12 leading-5 transition-colors motion-reduce:transition-none", active === id ? "bg-[#ede8f6] font-medium text-[#654e9f]" : "text-[#687080] hover:bg-[#f0f1f5]")}>
              {index === 0 ? <BookOpen size={14} aria-hidden /> : <span className="w-3.5 shrink-0 font-mono text-10 opacity-60">0{index}</span>}{title}
            </a>)}
          </nav>
          <label className="flex items-center justify-between gap-3 text-12 text-[#687080] md:hidden">
            <span className="flex items-center gap-2 whitespace-nowrap"><BookOpen size={15} aria-hidden />На странице</span>
            <span className="relative min-w-0 flex-1">
              <select aria-label="Перейти к разделу" value={active} onChange={(event) => { const id = event.target.value; setActive(id); document.getElementById(id)?.scrollIntoView({ behavior: "instant" }); history.replaceState(null, "", `#${id}`); }}
                className="min-h-11 w-full appearance-none rounded-lg border border-line bg-white pl-3 pr-8 text-12 text-ink">
                {integrationSections.map(({ id, title }) => <option key={id} value={id}>{title}</option>)}
              </select><ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-3.5" aria-hidden />
            </span>
          </label>
          <div className="mt-auto hidden pt-12 md:block">
            <div className="rounded-xl border border-line bg-white p-4">
              <CircleHelp size={18} className="mb-3 text-[#8b78b1]" aria-hidden />
              <p className="text-12 font-medium">Что-то не получается?</p>
              <p className="mt-2 text-11 leading-5 text-[#777e8c]">Орби знает это руководство и поможет с установкой.</p>
              <button type="button" onClick={() => ask("Помоги начать установку Орби")} className="mt-2 flex min-h-11 items-center gap-2 text-12 font-medium text-[#6a55a4]">Спросить Орби<ArrowUpRight size={14} aria-hidden /></button>
            </div>
            <p className="mt-5 text-10 leading-5 text-[#898e99]">Hack&Change 2026<br />Прототип · синтетические данные</p>
          </div>
        </div>
      </aside>

      <main id="integration-main" className="min-w-0 px-5 pb-24 sm:px-9 lg:px-14">{children}</main>
    </div>
  </div>;
}
