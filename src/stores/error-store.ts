import { create } from "zustand";
import { AppError, toAppError } from "@/lib/errors";

export interface ReportedError {
  id: string;
  at: number;
  title: string;
  systemMessage: string;
  hint: string;
  status?: number;
  source?: string;
}

interface ErrorState {
  /** Most-recent-first log of everything that has gone wrong this session. */
  log: ReportedError[];
  /** The error currently shown in the popup (null = closed). */
  active: ReportedError | null;
  report: (err: unknown, source?: string) => void;
  show: (id: string) => void;
  dismiss: () => void;
  clear: () => void;
}

const MAX_LOG = 30;

/**
 * Central sink for every user-facing error. Call `report(err)` from anywhere
 * (catch blocks, global window handlers) and the Error Center pops on top of the
 * whole app showing the title, the true system message, and how to fix it.
 */
export const useErrorStore = create<ErrorState>((set, get) => ({
  log: [],
  active: null,
  report: (err, source) => {
    const e: AppError = toAppError(err, source);
    const entry: ReportedError = {
      id:
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : String(Date.now() + Math.random()),
      at: Date.now(),
      title: e.title,
      systemMessage: e.systemMessage,
      hint: e.hint,
      status: e.status,
      source: e.source ?? source,
    };
    set((s) => ({ log: [entry, ...s.log].slice(0, MAX_LOG), active: entry }));
  },
  show: (id) => {
    const found = get().log.find((e) => e.id === id);
    if (found) set({ active: found });
  },
  dismiss: () => set({ active: null }),
  clear: () => set({ log: [], active: null }),
}));
