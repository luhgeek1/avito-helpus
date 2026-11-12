import NextLink from "next/link";
import { useParams as useNextParams, usePathname, useRouter as useNextRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { eventCategorySchema, eventFormatSchema } from "@/shared/api";
import { cx } from "@/shared/lib/cx";
import type { EventCategory, EventFormat } from "@/shared/api";

type SearchValues = { q?: string; channel?: string; category?: EventCategory; format?: EventFormat; period?: "today" | "week" | "month" };
type Navigation = { to?: string; params?: Record<string, string>; search?: SearchValues | ((previous: SearchValues) => SearchValues); replace?: boolean };

function href(to: string, params: Record<string, string> = {}, search?: SearchValues) {
  const pathname = to.replace(/\$(\w+)/g, (_, name: string) => encodeURIComponent(params[name] ?? ""));
  if (/^https?:\/\//.test(pathname)) return pathname;
  const url = new URL(pathname, "https://portal.local");
  if (search) {
    url.search = "";
    for (const [key, value] of Object.entries(search)) if (value !== undefined && value !== "") url.searchParams.set(key, value);
  }
  return url.pathname + url.search + url.hash;
}

function readSearch(serialized: string): SearchValues {
  const values = Object.fromEntries(new URLSearchParams(serialized));
  const category = eventCategorySchema.safeParse(values.category);
  const format = eventFormatSchema.safeParse(values.format);
  return { q: values.q, channel: values.channel, category: category.success ? category.data : undefined,
    format: format.success ? format.data : undefined,
    period: ["today", "week", "month"].includes(values.period) ? values.period as SearchValues["period"] : undefined };
}

export function useNavigate() {
  const router = useNextRouter(), pathname = usePathname(), serialized = useSearchParams().toString();
  return useCallback((options: Navigation) => {
    const search = typeof options.search === "function" ? options.search(readSearch(serialized)) : options.search;
    const destination = href(options.to ?? pathname, options.params, search);
    if (options.replace) router.replace(destination); else router.push(destination);
  }, [router, pathname, serialized]);
}

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  to: string; params?: Record<string, string>; search?: SearchValues; children?: ReactNode;
};
/** Portal link; colour changes fade unless the className sets another transition. */
export function Link({ to, params, search, children, className, ...rest }: LinkProps) {
  return (
    <NextLink href={href(to, params, search)} className={cx("transition-colors duration-150 ease-in-out", className)} {...rest}>
      {children}
    </NextLink>
  );
}

export function useRouterState<T>({ select }: { select: (state: { location: { pathname: string; search: SearchValues } }) => T }) {
  const pathname = usePathname(), serialized = useSearchParams().toString();
  return select({ location: { pathname, search: readSearch(serialized) } });
}

export function useRouter() {
  const router = useNextRouter();
  return { history: { back: () => router.back() } };
}

export function getRouteApi<T extends string>(route: T) {
  return {
    useParams: () => useNextParams<Record<string, string>>(),
    useNavigate,
    useSearch() {
      const serialized = useSearchParams().toString();
      return useMemo(() => {
        const search = readSearch(serialized);
        return (route === "/search" ? { q: search.q ?? "" } : search) as T extends "/search" ? { q: string } : SearchValues;
      }, [serialized]);
    },
  };
}
