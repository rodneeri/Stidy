"use client";

import { useState } from "react";
import { BookOpen } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { HELP, type HelpTopic } from "@/config/help";

/** Clickable manual cards — each opens the full page manual in a modal. */
export function ManualsGrid({ keys }: { keys: string[] }) {
  const [open, setOpen] = useState<HelpTopic | null>(null);

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        {keys.map((k) => {
          const t = HELP[k];
          if (!t) return null;
          return (
            <button
              key={k}
              onClick={() => setOpen(t)}
              className="neu-inset lift rounded-xl p-4 text-left"
            >
              <p className="text-sm font-semibold">{t.title}</p>
              <p className="mt-0.5 line-clamp-2 text-sm text-muted">{t.intro}</p>
              <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary">
                <BookOpen className="h-3.5 w-3.5" /> Open manual
              </span>
            </button>
          );
        })}
      </div>

      <Modal open={!!open} onClose={() => setOpen(null)} title={open?.title ?? ""}>
        {open && (
          <div className="-mr-2 max-h-[70vh] space-y-4 overflow-y-auto pr-2">
            <p className="text-sm text-muted">{open.intro}</p>
            <ul className="space-y-3">
              {open.points.map((p) => (
                <li key={p.heading} className="flex gap-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  <div>
                    <p className="text-sm font-medium">{p.heading}</p>
                    <p className="text-sm text-muted">{p.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Modal>
    </>
  );
}
