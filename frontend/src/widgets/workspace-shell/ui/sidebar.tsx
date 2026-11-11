import { useState } from "react";
import { ChevronRight, CircleHelp, Grid2X2, House } from "lucide-react";
import { pets } from "@/entities/pet";
import { AvitoMark } from "@/shared/ui/avito-mark";
import type { PageName, Navigate } from "@/shared/config";
export function Sidebar({
  page,
  navigate,
}: {
  page: PageName;
  navigate: Navigate;
}) {
  const [help, setHelp] = useState(false);
  return (
    <aside className={`sidebar fixed top-0 right-[auto] bottom-0 left-0 w-56 bg-white [border-right-width:1px]
            [border-right-style:solid] [border-right-color:var(--line)] pt-[30px] pb-0 flex flex-col z-20
            max-sm:bottom-[auto] max-sm:w-full max-sm:[border-right-width:0] max-sm:[border-right-color:currentColor]
            max-sm:pt-0 max-sm:flex-row max-md:items-center max-sm:h-[62px] max-sm:justify-between
            max-sm:[border-bottom-width:1px] max-sm:[border-bottom-style:solid] max-sm:[border-bottom-color:var(--line)]
            sm:max-md:w-[75px] sm:max-md:pt-[27px] md:max-lg:w-[195px] max-sm:[&_nav]:w-[auto] max-sm:[&_nav]:flex
            max-sm:[&_nav]:gap-[5px] sm:max-md:[&_nav]:mt-12 sm:max-md:[&_nav]:w-full px-[18px] sm:max-md:px-[10px]
            md:max-lg:px-3 max-sm:[&_nav]:m-0`}>
      <a
        className={`brand flex items-center gap-[9px] pl-[9px] text-[26px] font-[750] tracking-[-1.2px] leading-[1]
            max-sm:text-[21px] sm:max-md:text-[24px] md:max-lg:text-[24px] [&_>_span:last-child]:flex
            [&_>_span:last-child]:gap-[7px] [&_>_span:last-child]:items-baseline max-sm:[&_>_span:last-child]:gap-[5px]
            sm:max-md:[&_>_span:last-child]:hidden max-md:p-0`}
        href="/"
        onClick={(e) => {
          e.preventDefault();
          navigate("home");
        }}
        aria-label="Avito buddy — главная"
      >
        <AvitoMark />
        <span>
          Avito<span className={`brand-buddy text-[24px] tracking-[-1px] font-[450] text-[#777480] max-sm:text-[19px] max-xs:hidden
            sm:max-md:text-[21px] md:max-lg:text-[21px]`}>buddy</span>
        </span>
      </a>
      <div className={`workspace flex items-center gap-[10px] mt-9 mb-[33px] pb-6 [border-bottom-width:1px]
            [border-bottom-style:solid] [border-bottom-color:var(--line)] max-md:hidden [&_>_div]:flex [&_>_div]:flex-col
            [&_>_div]:gap-[5px] [&_strong]:text-[12px] [&_strong]:font-[550] [&_>_div_>_span]:text-[11px]
            [&_>_div_>_span]:text-[var(--muted)] mx-[6px]`}>
        <span className={`workspace-symbol w-[35px] h-[35px] rounded-[10px] flex place-content-center bg-[#f1eef8] text-[15px]
            font-semibold items-center text-[#7e6ca8] [&_span]:text-[#baa6dd]`}>
          a<span>·</span>b
        </span>
        <div>
          <strong>Твоё пространство</strong>
          <span>Начинаем вместе</span>
        </div>
      </div>
      <div className={`nav-label text-[9px] tracking-[1.2px] font-[550] text-[#a1a0aa] mt-0 mb-[13px] max-md:hidden mx-3`}>ПРОСТРАНСТВО</div>
      <nav aria-label="Главная навигация">
        <a
          href="/"
          className={`nav-item flex items-center gap-[11px] text-[13px] text-[#74727e] rounded-[9px] mb-[6px]
            [transition:background_0.15s] max-md:gap-0 max-md:text-[0px] max-sm:rounded-[7px] max-md:justify-center
            max-sm:min-h-11 md:max-lg:text-[12px] [&:hover]:bg-[#f5f3f9] [&.active]:bg-[#eee9f8] [&.active]:text-[#7760b2]
            [&.active]:font-[550] max-md:[&:not(.active)_.nav-count]:hidden max-sm:[&_svg]:w-[19px] max-sm:[&_svg]:h-[19px]
            max-xs:[&:last-child]:text-[9px] max-sm:[&:last-child]:gap-[7px] max-xs:[&:last-child]:whitespace-nowrap
            xs:max-sm:[&:last-child]:text-[10px] py-[14px] max-sm:py-[10px] sm:max-md:py-[15px] px-3 sm:max-md:px-0
            max-sm:m-0${page === "home" ? " active" : ""}`}
          aria-current={page === "home" ? "page" : undefined}
          onClick={(e) => {
            e.preventDefault();
            navigate("home");
          }}
        >
          <House size={19} />
          Главная
        </a>
        <a
          href="/pets"
          className={`nav-item flex items-center gap-[11px] text-[13px] text-[#74727e] rounded-[9px] mb-[6px]
            [transition:background_0.15s] max-md:gap-0 max-md:text-[0px] max-sm:rounded-[7px] max-md:justify-center
            max-sm:min-h-11 md:max-lg:text-[12px] [&:hover]:bg-[#f5f3f9] [&.active]:bg-[#eee9f8] [&.active]:text-[#7760b2]
            [&.active]:font-[550] max-md:[&:not(.active)_.nav-count]:hidden max-sm:[&_svg]:w-[19px] max-sm:[&_svg]:h-[19px]
            max-xs:[&:last-child]:text-[9px] max-sm:[&:last-child]:gap-[7px] max-xs:[&:last-child]:whitespace-nowrap
            xs:max-sm:[&:last-child]:text-[10px] py-[14px] max-sm:py-[10px] sm:max-md:py-[15px] px-3 sm:max-md:px-0
            max-sm:m-0${page === "pets" ? " active" : ""}`}
          aria-current={page === "pets" ? "page" : undefined}
          onClick={(e) => {
            e.preventDefault();
            navigate("pets");
          }}
        >
          <Grid2X2 size={19} />
          Галерея петов<span className={`nav-count text-[10px] font-medium grid place-items-center w-[23px] h-[21px] ml-auto bg-[#e4dcf2] rounded-[5px]
            max-md:hidden`}>{pets.length}</span>
        </a>
      </nav>
      <div className={`sidebar-bottom mt-auto relative max-md:hidden`}>
        <div className={`little-note bg-[#f7f6fb] mt-15 mb-6 pt-[17px] pb-6 rounded-[11px] relative overflow-hidden
            [&_strong]:text-[12px] [&_strong]:font-medium [&_strong]:leading-[1.6] [&_strong]:block
            [&_>_span:not(.note-star)]:block [&_>_span:not(.note-star)]:text-[9px]
            [&_>_span:not(.note-star)]:text-[#92909c] [&_>_span:not(.note-star)]:mt-[9px] border border-solid
            border-[#eeedf5] px-[15px] mx-[6px]`}>
          <span className="note-star block text-[#8d77b9] text-[24px] mb-[9px]">✦</span>
          <strong>
            Осваиваться проще,
            <br />
            когда ты не один.
          </strong>
          <span>Твой бадди всегда рядом.</span>
          <div className={`note-pixels absolute bottom-[-7px] right-[9px] flex items-end gap-1 [&_i]:w-3 [&_i]:h-[22px] [&_i]:bg-[#ded5f0]
            [&_i:nth-child(2)]:h-[13px] [&_i:nth-child(2)]:bg-[#d6e7d7] [&_i:nth-child(3)]:h-[30px]
            [&_i:nth-child(3)]:bg-[#eadcee]`}>
            <i />
            <i />
            <i />
          </div>
        </div>
        <button
          className={`help-button flex w-full items-center gap-[10px] bg-transparent text-[#81808b] text-[11px]
            [&_svg:last-child]:ml-auto p-3`}
          onClick={() => setHelp(!help)}
          aria-expanded={help}
        >
          <CircleHelp size={18} />О пространстве
          <ChevronRight size={16} />
        </button>
        {help && (
          <div className={`help-note absolute left-0 bottom-29 bg-white [box-shadow:0_8px_35px_#28203918] rounded-[10px] text-[11px]
            leading-[1.7] z-1 border border-solid border-[var(--line)] p-[15px]`}>
            Это дизайн-прототип AI-buddy для стажёров Авито. Пока здесь можно
            познакомиться с петами и выбрать спутника. Рабочий интерфейс
            появится позже.
          </div>
        )}
        <div className={`profile [border-top-width:1px] [border-top-style:solid] [border-top-color:var(--line)] flex items-center gap-2
            [&_>_div]:flex [&_>_div]:flex-col [&_>_div]:gap-[5px] [&_strong]:text-[10px] [&_strong]:font-medium
            [&_>_div_>_span]:text-[9px] [&_>_div_>_span]:text-[#9b99a2] py-[22px] px-[7px]`}>
          <span className={`avatar w-[30px] h-[30px] grid place-items-center bg-[#e9f0e4] text-[#6a8355] text-[11px] rounded-full shrink-0`}>Я</span>
          <div>
            <strong>Будущий авитовец</strong>
            <span>Твоя история начинается</span>
          </div>
          <span className="online-dot w-[5px] h-[5px] rounded-[50%] bg-[#95bc82] ml-auto" />
        </div>
      </div>
    </aside>
  );
}
