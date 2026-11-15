"use client";

import { useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { cx } from "@/shared/lib/cx";

/** Lightweight, escaped syntax colouring; code is never interpreted as markup. */
function highlight(line: string) {
  if (/^\s*(#|\/\/)/.test(line)) return <span className="text-[#91a0b4]">{line}</span>;
  return line.split(/("[^"\n]*"|'[^'\n]*'|\b(?:import|from|export|default|return|const|async|function|false|true|type)\b)/g).map((token, index) => (
    <span key={index} className={/^["']/.test(token) ? "text-[#adddc2]" : /^(import|from|export|default|return|const|async|function|false|true|type)$/.test(token) ? "text-[#cbb9f4]" : undefined}>{token}</span>
  ));
}

export function CodeBlock({ code, language, title, className }: { code: string; language: string; title: string; className?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const attempt = useRef(0);
  async function copy() {
    const current = ++attempt.current;
    try {
      await navigator.clipboard.writeText(code);
      if (current === attempt.current) setState("copied");
    } catch {
      if (current === attempt.current) setState("failed");
    }
  }
  return (
    <figure className={cx("min-w-0 overflow-hidden rounded-2xl border border-[#303845] bg-[#202630] text-[#e4e9f1]", className)}>
      <figcaption className="flex min-h-12 flex-wrap items-center justify-between gap-x-3 border-b border-white/10 bg-white/3 pl-4 pr-2 text-11">
        <span className="min-w-0 break-words py-2 text-[#b8c1d0]">{title}</span>
        <button type="button" onClick={() => { void copy(); }} aria-label={`Скопировать код: ${title}`}
          className="flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-[#dbe2ed] transition-colors hover:bg-white/10 motion-reduce:transition-none">
          {state === "copied" ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
          <span aria-live="polite">{state === "copied" ? "Скопировано" : "Копировать"}</span>
        </button>
      </figcaption>
      <pre tabIndex={0} aria-label={`Код ${language}`} className="overflow-x-auto overscroll-x-contain px-4 py-5 text-12 leading-6 [tab-size:2] focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-[#cbb9f4] sm:px-5 sm:text-13">
        <code>{code.split("\n").map((line, index) => <span key={index}>{index > 0 && "\n"}{highlight(line)}</span>)}</code>
      </pre>
      {state === "failed" && <p role="status" className="border-t border-white/10 px-4 py-3 text-12 text-[#e3cdac]">Браузер не разрешил копирование. Выдели код и скопируй вручную.</p>}
    </figure>
  );
}
