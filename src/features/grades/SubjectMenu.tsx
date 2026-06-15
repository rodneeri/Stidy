"use client";

import { useState } from "react";
import { MoreVertical } from "lucide-react";
import type { Subject } from "@/types/db";
import { ConfirmDelete } from "@/components/ui/ConfirmDelete";

const fld = "field w-full rounded-lg px-3 py-2 text-sm outline-none placeholder:text-muted";

interface Props {
  subject: Subject;
  onUpdate: (patch: Partial<Subject>) => void;
  onDelete: () => void;
}

/** Kebab dropdown to edit a subject's details (name/code/professor) or delete it. */
export function SubjectMenu({ subject, onUpdate, onDelete }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Subject options"
        aria-expanded={open}
        className="neu-btn grid h-9 w-9 place-items-center rounded-lg"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} aria-hidden />
          <div className="glass absolute right-0 top-11 z-30 w-64 space-y-2.5 p-4">
            <p className="text-xs font-medium text-muted">Edit subject</p>
            <input
              defaultValue={subject.name}
              onBlur={(e) => onUpdate({ name: e.target.value.trim() || subject.name })}
              placeholder="Name"
              className={fld}
            />
            <input
              defaultValue={subject.code ?? ""}
              onBlur={(e) => onUpdate({ code: e.target.value.trim() || null })}
              placeholder="Code (e.g. MATH 102)"
              className={fld}
            />
            <input
              defaultValue={subject.professor ?? ""}
              onBlur={(e) => onUpdate({ professor: e.target.value.trim() || null })}
              placeholder="Professor"
              className={fld}
            />
            <div className="flex items-center justify-between border-t border-border/60 pt-2.5">
              <span className="text-xs text-muted">Delete subject</span>
              <ConfirmDelete
                label="Delete subject"
                onConfirm={() => {
                  onDelete();
                  setOpen(false);
                }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
