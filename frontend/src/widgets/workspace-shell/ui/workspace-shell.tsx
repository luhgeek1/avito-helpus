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
    <div className="app-shell">
      <Sidebar page={page} navigate={navigate} />
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Пространство
            <ChevronRight size={14} />
            <span>{page === "pets" ? "Галерея петов" : "Главная"}</span>
          </div>
          <span className="prototype">
            <i />
            Дизайн-прототип
          </span>
        </header>
        {children}
      </div>
      {companion}
      <a
        className="skip-link"
        href="#root"
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
