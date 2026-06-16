"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, GraduationCap, CalendarClock, CheckCircle2 } from "lucide-react";
import { formatDistanceToNowStrict, isToday } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { spring } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface Reminder {
  id: string;
  title: string;
  due_at: string;
  is_exam: boolean;
}

const WINDOW_DAYS = 7;

/** Topbar bell → upcoming exams & overdue/soon tasks pulled live from the timetable. */
export function NotificationsBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("tasks")
        .select("id,title,due_at,is_exam")
        .neq("status", "done")
        .neq("status", "archived")
        .not("due_at", "is", null)
        .order("due_at", { ascending: true });
      if (!alive || !data) return;
      const horizon = Date.now() + WINDOW_DAYS * 86_400_000;
      setReminders(
        (data as Reminder[]).filter((t) => t.due_at && new Date(t.due_at).getTime() <= horizon),
      );
    })();
    return () => {
      alive = false;
    };
  }, [supabase]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const count = reminders.length;

  const go = () => {
    setOpen(false);
    router.push("/timetable");
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={count ? `Notifications (${count})` : "Notifications"}
        onClick={() => setOpen((o) => !o)}
        className="neu-btn relative grid h-9 w-9 place-items-center rounded-full"
      >
        <Bell className="h-4 w-4" />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground shadow-[var(--shadow-glow)]">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -6 }}
            transition={spring.pop}
            className="glass absolute right-0 top-12 z-40 w-80 origin-top-right overflow-hidden p-1.5"
          >
            <div className="flex items-center justify-between px-3 py-2">
              <p className="text-sm font-semibold tracking-tight">Upcoming</p>
              <span className="text-[11px] text-muted">next {WINDOW_DAYS} days</span>
            </div>

            <div className="max-h-80 overflow-auto">
              {count === 0 ? (
                <div className="flex flex-col items-center gap-2 px-3 py-8 text-center">
                  <CheckCircle2 className="h-7 w-7 text-primary" />
                  <p className="text-sm text-muted">You&apos;re all caught up.</p>
                </div>
              ) : (
                reminders.map((r) => {
                  const due = new Date(r.due_at);
                  const overdue = due.getTime() < Date.now() && !isToday(due);
                  const when = isToday(due)
                    ? "today"
                    : overdue
                      ? `overdue ${formatDistanceToNowStrict(due)}`
                      : `in ${formatDistanceToNowStrict(due)}`;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={go}
                      className="pressable flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left"
                    >
                      <span
                        className={cn(
                          "grid h-8 w-8 shrink-0 place-items-center rounded-lg",
                          r.is_exam ? "bg-primary/15 text-primary" : "bg-foreground/5 text-muted",
                        )}
                      >
                        {r.is_exam ? (
                          <GraduationCap className="h-4 w-4" />
                        ) : (
                          <CalendarClock className="h-4 w-4" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-foreground">{r.title}</span>
                        <span className={cn("text-xs", overdue ? "text-warning" : "text-muted")}>
                          {r.is_exam ? "Exam · " : ""}
                          {when}
                        </span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
