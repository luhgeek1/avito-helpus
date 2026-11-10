import { useEffect, useState } from "react";
import { routes } from "@/shared/config";
import type { PageName, Navigate } from "@/shared/config";
const currentPage = (): PageName =>
  location.pathname === routes.pets ? "pets" : "home";
export function useRoute() {
  const [page, setPage] = useState<PageName>(currentPage);
  useEffect(() => {
    const sync = () => setPage(currentPage());
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  useEffect(() => {
    document.title =
      page === "pets" ? "Галерея петов — Avito buddy" : "Главная — Avito buddy";
  }, [page]);
  const navigate: Navigate = (next) => {
    history.pushState({}, "", routes[next]);
    setPage(next);
    window.scrollTo(0, 0);
  };
  return { page, navigate };
}
