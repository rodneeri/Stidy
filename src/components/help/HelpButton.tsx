"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { HelpCircle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { helpFor } from "@/config/help";

/** Floating, context-aware help — explains whatever tab you're currently in. */
export function HelpButton() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const topic = helpFor(pathname);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Help for this page"
        title="Help for this page"
        className="pressable grid h-10 w-10 place-items-center rounded-full text-muted hover:text-primary"
      >
        <HelpCircle className="h-5 w-5" />
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={topic.title}>
        <div className="-mr-2 max-h-[70vh] space-y-4 overflow-y-auto pr-2">
          <p className="text-sm text-muted">{topic.intro}</p>
          <ul className="space-y-3">
            {topic.points.map((p) => (
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
      </Modal>
    </>
  );
}
