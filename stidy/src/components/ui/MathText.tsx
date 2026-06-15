"use client";

import katex from "katex";
import { cn } from "@/lib/utils";

function tex(src: string, display: boolean) {
  try {
    return katex.renderToString(src, { throwOnError: false, displayMode: display });
  } catch {
    return src;
  }
}

/** Renders text with embedded LaTeX math: $inline$ and $$display$$. */
export function MathText({ children, className }: { children: string; className?: string }) {
  const parts: { text?: string; math?: string; display?: boolean }[] = [];
  const re = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(children))) {
    if (m.index > last) parts.push({ text: children.slice(last, m.index) });
    if (m[1] != null) parts.push({ math: m[1], display: true });
    else parts.push({ math: m[2], display: false });
    last = re.lastIndex;
  }
  if (last < children.length) parts.push({ text: children.slice(last) });

  return (
    <span className={cn("[&_.katex]:text-[1em]", className)}>
      {parts.map((p, i) =>
        p.math != null ? (
          <span key={i} dangerouslySetInnerHTML={{ __html: tex(p.math, !!p.display) }} />
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </span>
  );
}
