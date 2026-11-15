import Link from "next/link";
import { Code2, Play } from "lucide-react";
import { cx } from "@/shared/lib/cx";

export function ExperienceSwitcher({ demo = false }: { demo?: boolean }) {
  return <nav aria-label="Режим сайта" className="inline-flex shrink-0 gap-1 rounded-xl border border-line bg-[#f2f3f6] p-1 text-12 font-medium">
    {[{ href: "/", title: "Интеграция", Icon: Code2, active: !demo }, { href: "/demo", title: "Демо", Icon: Play, active: demo }].map(({ href, title, Icon, active }) => (
      <Link key={href} href={href} aria-current={active ? "page" : undefined}
        className={cx("flex min-h-10 items-center gap-2 rounded-lg px-3 transition-colors motion-reduce:transition-none", active ? "bg-white text-ink shadow-sm" : "text-[#676c7b] hover:bg-white/70 hover:text-ink")}>
        <Icon size={14} aria-hidden />{title}
      </Link>
    ))}
  </nav>;
}
