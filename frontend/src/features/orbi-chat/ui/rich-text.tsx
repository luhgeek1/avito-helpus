import { Fragment } from "react";
import type { ReactNode } from "react";

/** Inline marks the model uses: **bold**, `code` and [n] source references. */
function inline(text: string, key: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[\d+\])/g).filter(Boolean).map((token, index) => {
    const id = `${key}-${index}`;
    if (token.startsWith("**") && token.endsWith("**")) return <strong key={id} className="font-semibold">{token.slice(2, -2)}</strong>;
    if (token.startsWith("`") && token.endsWith("`")) return <code key={id} className="rounded bg-white/70 px-1 font-mono text-12">{token.slice(1, -1)}</code>;
    if (/^\[\d+\]$/.test(token)) {
      return <sup key={id} className="ml-0.5 rounded bg-blue-soft px-1 text-9 font-semibold text-blue-text" aria-label={`источник ${token.slice(1, -1)}`}>{token.slice(1, -1)}</sup>;
    }
    return <Fragment key={id}>{token}</Fragment>;
  });
}

const LIST_ITEM = /^\s*(?:\d+[.)]|[-•*])\s+/;

/** Paragraphs and simple lists; anything else stays plain text (no HTML from the model). */
export function RichText({ text }: { text: string }) {
  const blocks = text.trim().split(/\n{2,}/);
  return (
    <div className="space-y-2">
      {blocks.map((block, index) => {
        const lines = block.split("\n");
        const key = `b${index}`;
        if (lines.length > 0 && lines.every((line) => LIST_ITEM.test(line))) {
          const ordered = /^\s*\d/.test(lines[0]);
          const List = ordered ? "ol" : "ul";
          return (
            <List key={key} className={ordered ? "list-decimal space-y-1 pl-5" : "list-disc space-y-1 pl-5"}>
              {lines.map((line, i) => <li key={`${key}-${i}`}>{inline(line.replace(LIST_ITEM, ""), `${key}-${i}`)}</li>)}
            </List>
          );
        }
        return <p key={key} className="whitespace-pre-wrap">{inline(block, key)}</p>;
      })}
    </div>
  );
}
