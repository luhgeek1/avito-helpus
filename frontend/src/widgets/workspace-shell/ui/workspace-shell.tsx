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
    <div className="min-h-screen">
      <Sidebar page={page} navigate={navigate} />
      <div className="ml-56 max-sm:mx-0 max-sm:mt-15.5 max-sm:mb-0 sm:max-md:ml-18.75 md:max-lg:ml-48.75">
        <header className="flex h-19.25 items-center justify-between border-b border-line bg-white px-10 max-sm:h-13 max-sm:px-5 sm:max-md:h-16.25 sm:max-md:px-6 md:max-lg:px-7">
          <div className="flex items-center gap-2.75 text-11 text-[#9998a2] max-sm:gap-1.75 max-sm:text-9">
            Пространство
            <ChevronRight size={14} className="text-[#c0bdc8]" />
            <span className="text-[#56535e]">{page === "pets" ? "Галерея петов" : "Главная"}</span>
          </div>
          <span className="flex items-center gap-1.75 text-10 text-[#908d99] max-sm:gap-1 max-sm:text-8">
            <i className="size-1.25 rounded-full bg-[#a899c2]" />
            Дизайн-прототип
          </span>
        </header>
        {children}
      </div>
      {companion}
      <a
        className="fixed -top-17.5 left-3 z-100 rounded-lg border-2 border-lilac bg-white px-5 py-3 focus:top-3"
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
