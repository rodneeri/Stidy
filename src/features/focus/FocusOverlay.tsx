"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Play, Pause, Maximize2, Timer as TimerIcon, Watch } from "lucide-react";
import { useFocusStore, focusTotal } from "@/stores/focus-store";
import { cn } from "@/lib/utils";

const mmss = (s: number) => {
  const sec = Math.max(0, s);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const ss = sec % 60;
  return h > 0
    ? `${h}:${m.toString().padStart(2, "0")}:${ss.toString().padStart(2, "0")}`
    : `${m.toString().padStart(2, "0")}:${ss.toString().padStart(2, "0")}`;
};
const swText = (ms: number) => {
  const t = Math.floor(ms / 1000);
  return `${Math.floor(t / 60)
    .toString()
    .padStart(2, "0")}:${(t % 60).toString().padStart(2, "0")}`;
};

/**
 * Single always-mounted client component in the app shell. It (a) initialises
 * the focus store, (b) runs the one global clock interval so timers keep running
 * no matter which tab you're on, and (c) renders a draggable picture-in-picture
 * mini-clock whenever a timer/stopwatch is live and you've left the Focus page.
 */
export function FocusOverlay() {
  const pathname = usePathname();
  const router = useRouter();
  const init = useFocusStore((s) => s.init);
  const tick = useFocusStore((s) => s.tick);
  const running = useFocusStore((s) => s.running);
  const swRunning = useFocusStore((s) => s.swRunning);
  const view = useFocusStore((s) => s.view);
  const mode = useFocusStore((s) => s.mode);
  const secondsLeft = useFocusStore((s) => s.secondsLeft);
  const swMs = useFocusStore((s) => s.swMs);
  const preset = useFocusStore((s) => s.preset);
  const toggleRun = useFocusStore((s) => s.toggleRun);
  const toggleSw = useFocusStore((s) => s.toggleSw);

  const active = running || swRunning;
  const onFocusPage = pathname === "/focus";

  useEffect(() => {
    void init();
  }, [init]);

  // One global ticker. Fast (stopwatch) only while the stopwatch runs.
  useEffect(() => {
    if (!running && !swRunning) return;
    const ms = swRunning ? 100 : 1000;
    const id = setInterval(tick, ms);
    const onVisible = () => !document.hidden && tick();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [running, swRunning, tick]);

  const constraintsRef = useRef<HTMLDivElement>(null);
  const isTimer = view === "timer";
  const total = focusTotal({ mode, preset });
  const pct = isTimer && total > 0 ? Math.min(100, ((total - secondsLeft) / total) * 100) : 100;
  const accent = mode === "focus" ? "var(--primary)" : "var(--secondary)";
  const playing = isTimer ? running : swRunning;
  const label = isTimer ? mmss(secondsLeft) : swText(swMs);

  return (
    <>
      {/* Full-viewport drag bounds so the PiP can be dropped anywhere. */}
      <div ref={constraintsRef} className="pointer-events-none fixed inset-3 z-[45]" />
      <AnimatePresence>
        {active && !onFocusPage && (
          <motion.div
            drag
            dragConstraints={constraintsRef}
            dragMomentum={false}
            dragElastic={0.06}
            initial={{ opacity: 0, scale: 0.6, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.6, y: 24 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            whileDrag={{ scale: 1.05, cursor: "grabbing" }}
            className="glass fixed bottom-24 right-6 z-[46] flex cursor-grab touch-none select-none items-center gap-3 rounded-2xl p-3 pr-4 shadow-lg"
            role="status"
            aria-label="Focus timer running"
          >
            {/* mini ring */}
            <button
              onClick={() => router.push("/focus")}
              className="relative grid h-12 w-12 shrink-0 place-items-center"
              aria-label="Expand to Focus"
            >
              <svg viewBox="0 0 100 100" className="h-12 w-12 -rotate-90">
                <circle cx="50" cy="50" r="44" fill="none" stroke="hsl(var(--border))" strokeWidth="9" />
                <circle
                  cx="50"
                  cy="50"
                  r="44"
                  fill="none"
                  stroke={`hsl(${accent})`}
                  strokeWidth="9"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 44}
                  strokeDashoffset={2 * Math.PI * 44 * (1 - pct / 100)}
                  style={{ transition: "stroke-dashoffset 0.5s linear" }}
                />
              </svg>
              <span className="absolute grid place-items-center text-primary">
                {isTimer ? <TimerIcon className="h-4 w-4" /> : <Watch className="h-4 w-4" />}
              </span>
            </button>

            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted">
                {isTimer ? mode : "Stopwatch"}
              </p>
              <p className="text-lg font-semibold leading-none tabular-nums">{label}</p>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={isTimer ? toggleRun : toggleSw}
                className="neu-btn grid h-9 w-9 place-items-center rounded-full text-primary"
                aria-label={playing ? "Pause" : "Start"}
              >
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </button>
              <button
                onClick={() => router.push("/focus")}
                className={cn("pressable grid h-9 w-9 place-items-center rounded-full text-muted hover:text-primary")}
                aria-label="Open Focus"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
