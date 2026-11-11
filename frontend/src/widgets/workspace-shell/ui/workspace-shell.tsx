import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import type { PageName, Navigate } from "@/shared/config";
import { Sidebar } from "./sidebar";
interface WorkspaceShellProps {
  page: PageName;
  navigate: Navigate;
  children: ReactNode;
  companion: ReactNode;
}
export function WorkspaceShell({
  page,
  navigate,
  children,
  companion,
}: WorkspaceShellProps) {
  return (
    <div className="app-shell min-h-[100vh]">
      <Sidebar page={page} navigate={navigate} />
      <div className={`main-shell ml-56 max-sm:mt-[62px] max-sm:mb-0 sm:max-md:ml-[75px] md:max-lg:ml-[195px] max-sm:mx-0`}>
        <header className={`topbar h-[77px] flex justify-between items-center [border-bottom-width:1px] [border-bottom-style:solid]
            [border-bottom-color:var(--line)] bg-white max-sm:h-13 sm:max-md:h-[65px] py-0 px-10 max-sm:px-5 sm:max-md:px-6
            md:max-lg:px-7`}>
          <div className={`breadcrumb flex gap-[11px] items-center text-[#9998a2] text-[11px] max-sm:gap-[7px] max-sm:text-[9px]
            [&_>_span]:text-[#56535e] [&_>_svg]:text-[#c0bdc8]`}>
            Пространство
            <ChevronRight size={14} />
            <span>{page === "pets" ? "Галерея петов" : "Главная"}</span>
          </div>
          <span className={`prototype flex gap-[7px] items-center text-[10px] text-[#908d99] max-sm:gap-1 max-sm:text-[8px] [&_i]:w-[5px]
            [&_i]:h-[5px] [&_i]:bg-[#a899c2] [&_i]:rounded-full`}>
            <i />
            Дизайн-прототип
          </span>
        </header>
        {children}
      </div>
      {companion}
      <a
        className={`skip-link fixed left-3 top-[-70px] bg-white z-100 rounded-[8px] [&:focus]:top-3 border-[2px] border-solid
            border-[#7760c4] py-3 px-5`}
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          const main = document.querySelector("main");
          main?.setAttribute("tabindex", "-1");
          main?.focus();
        }}
      >
        К содержимому
      </a>
    </div>
  );
}
