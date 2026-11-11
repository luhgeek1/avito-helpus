import { useSyncExternalStore } from "react";

let entries = ["/"], position = 0;
const listeners = new Set<() => void>();
const current = () => entries[position];
const emit = () => { window.history.replaceState(null, "", current()); for (const listener of listeners) listener(); };
export const navigation = {
  push(url: string) { entries = [...entries.slice(0, position + 1), url]; position++; emit(); },
  replace(url: string) { entries[position] = url; emit(); },
  back() { position = Math.max(0, position - 1); emit(); },
  forward() { position = Math.min(entries.length - 1, position + 1); emit(); },
  refresh() {}, prefetch() {},
};
export function resetNavigation(url: string) { entries = [url]; position = 0; emit(); }
export function useLocation() {
  const url = useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, current, current);
  return new URL(url, "http://localhost:5173");
}
export function useParams() {
  const { pathname } = useLocation();
  const [group, value = ""] = pathname.slice(1).split("/");
  const key = ({ people: "personId", services: "serviceId", feed: "postId", benefits: "categoryId" } as Record<string, string>)[group];
  return key ? { [key]: decodeURIComponent(value) } : {};
}
export const history = { get location() { return new URL(current(), "http://localhost:5173"); } };
