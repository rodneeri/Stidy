"use client";

import { useEffect, useState } from "react";
import { Trash2, X, Plus } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/utils";

export interface ReviewData {
  name: string;
  code: string | null;
  professor: string | null;
  categories: { name: string; weight: number; items: { name: string; weight: number }[] }[];
}

const fld = "field rounded-lg px-3 py-2 text-sm outline-none placeholder:text-muted";
const num = (v: string) => (v === "" ? 0 : parseFloat(v) || 0);

export function SyllabusReviewDialog({
  data,
  onConfirm,
  onCancel,
}: {
  data: ReviewData | null;
  onConfirm: (d: ReviewData) => void;
  onCancel: () => void;
}) {
  const [d, setD] = useState<ReviewData | null>(data);
  useEffect(() => {
    if (data) setD(data);
  }, [data]);

  const set = (next: ReviewData) => setD({ ...next });
  const setCat = (ci: number, patch: Partial<ReviewData["categories"][number]>) =>
    d && set({ ...d, categories: d.categories.map((c, i) => (i === ci ? { ...c, ...patch } : c)) });
  const setItem = (ci: number, ii: number, patch: Partial<{ name: string; weight: number }>) =>
    d &&
    set({
      ...d,
      categories: d.categories.map((c, i) =>
        i !== ci ? c : { ...c, items: c.items.map((it, j) => (j === ii ? { ...it, ...patch } : it)) },
      ),
    });

  const total = d ? d.categories.reduce((s, c) => s + (Number(c.weight) || 0), 0) : 0;

  return (
    <Modal open={!!data} onClose={onCancel} title="Review syllabus">
      {d && (
        <>
          <div className="-mr-2 max-h-[65vh] space-y-4 overflow-y-auto pr-2">
            <p className="text-sm text-muted">
              Here&apos;s what we found in your syllabus. Check it and fix any mistakes before
              importing.
            </p>

            <div className="grid grid-cols-2 gap-2">
              <input
                value={d.name}
                onChange={(e) => set({ ...d, name: e.target.value })}
                placeholder="Subject name"
                className={cn(fld, "col-span-2")}
              />
              <input
                value={d.code ?? ""}
                onChange={(e) => set({ ...d, code: e.target.value || null })}
                placeholder="Code"
                className={fld}
              />
              <input
                value={d.professor ?? ""}
                onChange={(e) => set({ ...d, professor: e.target.value || null })}
                placeholder="Professor"
                className={fld}
              />
            </div>

            <div className="space-y-3">
              {d.categories.map((c, ci) => (
                <div key={ci} className="neu-inset space-y-2 rounded-xl p-3">
                  <div className="flex items-center gap-2">
                    <input
                      value={c.name}
                      onChange={(e) => setCat(ci, { name: e.target.value })}
                      placeholder="Category"
                      className={cn(fld, "flex-1 font-medium")}
                    />
                    <input
                      type="number"
                      value={c.weight}
                      onChange={(e) => setCat(ci, { weight: num(e.target.value) })}
                      className={cn(fld, "w-16 text-right")}
                    />
                    <span className="text-sm text-muted">%</span>
                    <button
                      onClick={() => set({ ...d, categories: d.categories.filter((_, i) => i !== ci) })}
                      aria-label="Remove category"
                      className="pressable grid h-8 w-8 place-items-center rounded-lg text-muted hover:text-danger"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {c.items.map((it, ii) => (
                    <div key={ii} className="flex items-center gap-2 pl-3">
                      <input
                        value={it.name}
                        onChange={(e) => setItem(ci, ii, { name: e.target.value })}
                        placeholder="Sub-item"
                        className={cn(fld, "flex-1")}
                      />
                      <input
                        type="number"
                        value={it.weight}
                        onChange={(e) => setItem(ci, ii, { weight: num(e.target.value) })}
                        className={cn(fld, "w-16 text-right")}
                      />
                      <span className="text-xs text-muted">%</span>
                      <button
                        onClick={() =>
                          setCat(ci, { items: c.items.filter((_, j) => j !== ii) })
                        }
                        aria-label="Remove sub-item"
                        className="text-muted hover:text-danger"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}

                  <button
                    onClick={() => setCat(ci, { items: [...c.items, { name: "", weight: 0 }] })}
                    className="pressable pl-3 text-xs font-medium text-primary"
                  >
                    + Sub-item
                  </button>
                </div>
              ))}

              <button
                onClick={() => set({ ...d, categories: [...d.categories, { name: "", weight: 0, items: [] }] })}
                className="neu-btn flex items-center gap-1.5 px-3 py-2 text-sm font-medium"
              >
                <Plus className="h-4 w-4" /> Category
              </button>
            </div>

            <p className={cn("text-sm", Math.abs(total - 100) < 0.01 ? "text-muted" : "text-warning")}>
              Category weights total {total}%{Math.abs(total - 100) >= 0.01 && " — should be 100%"}
            </p>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={onCancel}
              className="pressable rounded-xl px-4 py-2 text-sm text-muted hover:text-foreground"
            >
              Cancel
            </button>
            <button
              onClick={() => onConfirm(d)}
              disabled={!d.name.trim()}
              className="neu-btn px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              Confirm &amp; import
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
