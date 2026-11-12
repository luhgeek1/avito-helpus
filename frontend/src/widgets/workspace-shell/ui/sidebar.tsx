import { useState } from "react";
import { ChevronRight, CircleHelp, Grid2X2, House } from "lucide-react";
import { pets } from "@/entities/pet";
import { AvitoMark } from "@/shared/ui/avito-mark";
import type { PageName, Navigate } from "@/shared/config";
import { cx } from "@/shared/lib/cx";

const navItem = cx(
  "mb-1.5 flex items-center gap-2.75 rounded-[9px] px-3 py-3.5 text-13 text-[#74727e] transition-[background] duration-150",
  "hover:bg-[#f5f3f9] max-md:justify-center max-md:gap-0 max-md:text-[0px] max-sm:m-0 max-sm:min-h-11",
  "max-sm:rounded-[7px] max-sm:py-2.5 sm:max-md:px-0 sm:max-md:py-3.75 md:max-lg:text-12",
);
const navItemActive = "bg-[#eee9f8] font-[550] text-[#7760b2]";
export function Sidebar({
  page,
  navigate,
}: {
  page: PageName;
  navigate: Navigate;
}) {
  const [help, setHelp] = useState(false);
  return (
    <aside className="fixed inset-y-0 left-0 z-20 flex w-56 flex-col border-r border-line bg-white px-4.5 pt-7.5
            max-md:items-center max-sm:bottom-auto max-sm:h-15.5 max-sm:w-full max-sm:flex-row max-sm:justify-between
            max-sm:border-r-0 max-sm:border-b max-sm:pt-0 sm:max-md:w-18.75 sm:max-md:px-2.5 sm:max-md:pt-6.75
            md:max-lg:w-48.75 md:max-lg:px-3">
      <a
        className="flex items-center gap-2.25 pl-2.25 text-26 leading-none font-[750] tracking-[-1.2px] max-md:p-0
            max-sm:text-21 sm:max-md:text-24 md:max-lg:text-24"
        href="/"
        onClick={(e) => {
          e.preventDefault();
          navigate("home");
        }}
        aria-label="Avito buddy — главная"
      >
        <AvitoMark />
        <span className="flex items-baseline gap-1.75 max-sm:gap-1.25 sm:max-md:hidden">
          Avito<span className="text-24 font-[450] tracking-[-1px] text-[#777480] max-sm:text-19 max-xs:hidden
            sm:max-md:text-21 md:max-lg:text-21">buddy</span>
        </span>
      </a>
      <div className="mx-1.5 mt-9 mb-8.25 flex items-center gap-2.5 border-b border-line pb-6 max-md:hidden">
        <span className="flex size-8.75 place-content-center items-center rounded-[10px] bg-[#f1eef8] text-15
            font-semibold text-[#7e6ca8]">
          a<span className="text-[#baa6dd]">·</span>b
        </span>
        <div className="flex flex-col gap-1.25">
          <strong className="text-12 font-[550]">Твоё пространство</strong>
          <span className="text-11 text-muted">Начинаем вместе</span>
        </div>
      </div>
      <div className="mx-3 mb-3.25 text-9 font-[550] tracking-[1.2px] text-[#a1a0aa] max-md:hidden">ПРОСТРАНСТВО</div>
      <nav
        aria-label="Главная навигация"
        className="max-sm:m-0 max-sm:flex max-sm:w-auto max-sm:gap-1.25 sm:max-md:mt-12 sm:max-md:w-full"
      >
        <a
          href="/"
          className={cx(navItem, page === "home" && navItemActive)}
          aria-current={page === "home" ? "page" : undefined}
          onClick={(e) => {
            e.preventDefault();
            navigate("home");
          }}
        >
          <House size={19} className="max-sm:size-4.75" />
          Главная
        </a>
        <a
          href="/pets"
          className={cx(navItem, "max-sm:gap-1.75 max-xs:text-9 max-xs:whitespace-nowrap xs:max-sm:text-10",
            page === "pets" && navItemActive)}
          aria-current={page === "pets" ? "page" : undefined}
          onClick={(e) => {
            e.preventDefault();
            navigate("pets");
          }}
        >
          <Grid2X2 size={19} className="max-sm:size-4.75" />
          Галерея петов<span className="ml-auto grid h-5.25 w-5.75 place-items-center rounded-[5px] bg-[#e4dcf2] text-10
            font-medium max-md:hidden">{pets.length}</span>
        </a>
      </nav>
      <div className="relative mt-auto max-md:hidden">
        <div className="relative mx-1.5 mt-15 mb-6 overflow-hidden rounded-[11px] border border-[#eeedf5] bg-[#f7f6fb]
            px-3.75 pt-4.25 pb-6">
          <span className="mb-2.25 block text-24 text-[#8d77b9]">✦</span>
          <strong className="block text-12 leading-[1.6] font-medium">
            Осваиваться проще,
            <br />
            когда ты не один.
          </strong>
          <span className="mt-2.25 block text-9 text-[#92909c]">Твой бадди всегда рядом.</span>
          <div className="absolute right-2.25 -bottom-1.75 flex items-end gap-1">
            <i className="h-5.5 w-3 bg-[#ded5f0]" />
            <i className="h-3.25 w-3 bg-[#d6e7d7]" />
            <i className="h-7.5 w-3 bg-[#eadcee]" />
          </div>
        </div>
        <button
          className="flex w-full items-center gap-2.5 bg-transparent p-3 text-11 text-[#81808b]"
          onClick={() => setHelp(!help)}
          aria-expanded={help}
        >
          <CircleHelp size={18} />О пространстве
          <ChevronRight size={16} className="ml-auto" />
        </button>
        {help && (
          <div className="absolute bottom-29 left-0 z-1 rounded-[10px] border border-line bg-white p-3.75 text-11
            leading-[1.7] shadow-[0_8px_35px_#28203918]">
            Это дизайн-прототип AI-buddy для стажёров Авито. Пока здесь можно
            познакомиться с петами и выбрать спутника. Рабочий интерфейс
            появится позже.
          </div>
        )}
        <div className="flex items-center gap-2 border-t border-line px-1.75 py-5.5">
          <span className="grid size-7.5 shrink-0 place-items-center rounded-full bg-[#e9f0e4] text-11 text-[#6a8355]">Я</span>
          <div className="flex flex-col gap-1.25">
            <strong className="text-10 font-medium">Будущий авитовец</strong>
            <span className="text-9 text-[#9b99a2]">Твоя история начинается</span>
          </div>
          <span className="ml-auto size-1.25 rounded-full bg-[#95bc82]" />
        </div>
      </div>
    </aside>
  );
}
