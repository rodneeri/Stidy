"use client";

import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";

export type Mode = "focus" | "break";
export type View = "timer" | "stopwatch";
export interface Preset {
  label: string;
  focus: number; // minutes
  brk: number; // minutes
}

export const PRESETS: Preset[] = [
  { label: "Pomodoro", focus: 25, brk: 5 },
  { label: "Deep work", focus: 50, brk: 10 },
];

/** A soft bell arpeggio, no audio assets. Fires when a phase completes. */
export function playAlarm() {
  try {
    const ctx = new AudioContext();
    const master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
    const bell = (t: number, freq: number, dur: number, vol: number) => {
      const o = ctx.createOscillator();
      const o2 = ctx.createOscillator();
      const g = ctx.createGain();
      const g2 = ctx.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      o2.type = "sine";
      o2.frequency.value = freq * 2.01;
      g2.gain.value = 0.22;
      o.connect(g);
      o2.connect(g2).connect(g);
      g.connect(master);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.start(t);
      o2.start(t);
      o.stop(t + dur);
      o2.stop(t + dur);
    };
    const chord = [523.25, 659.25, 783.99];
    const reps = 5;
    const gap = 1.5;
    const start = ctx.currentTime + 0.05;
    for (let r = 0; r < reps; r++) {
      const base = start + r * gap;
      chord.forEach((f, i) => bell(base + i * 0.16, f, 1.9, 0.16));
    }
    setTimeout(() => ctx.close(), (reps * gap + 2.4) * 1000);
  } catch {
    /* ignore */
  }
}

interface FocusState {
  ready: boolean;
  userId: string | null;
  subjects: { id: string; name: string }[];
  subjectId: string;

  view: View;
  preset: Preset;
  customSec: number;
  mode: Mode;
  secondsLeft: number;
  running: boolean;
  sessions: number;
  endAt: number | null; // target end timestamp (ms) while running

  // stopwatch
  swMs: number;
  swRunning: boolean;
  swStart: number | null;
  laps: number[];

  // stats
  todaySec: number;
  weekSec: number;

  init: () => Promise<void>;
  loadStats: () => Promise<void>;
  setSubjectId: (id: string) => void;
  setView: (v: View) => void;
  choosePreset: (p: Preset) => void;
  applyCustom: (secs: number) => void;
  toggleRun: () => void;
  reset: () => void;
  skip: () => void;
  tick: () => void;
  toggleSw: () => void;
  resetSw: () => void;
  lap: () => void;
  logStudy: (seconds: number) => Promise<void>;
}

const totalOf = (s: Pick<FocusState, "mode" | "preset">) =>
  (s.mode === "focus" ? s.preset.focus : s.preset.brk) * 60;

export const useFocusStore = create<FocusState>((set, get) => ({
  ready: false,
  userId: null,
  subjects: [],
  subjectId: "",

  view: "timer",
  preset: PRESETS[0],
  customSec: 25 * 60,
  mode: "focus",
  secondsLeft: PRESETS[0].focus * 60,
  running: false,
  sessions: 0,
  endAt: null,

  swMs: 0,
  swRunning: false,
  swStart: null,
  laps: [],

  todaySec: 0,
  weekSec: 0,

  init: async () => {
    if (get().ready) return;
    set({ ready: true });
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data } = await supabase
        .from("subjects")
        .select("id, name")
        .is("parent_id", null)
        .order("name");
      set({
        userId: user?.id ?? null,
        subjects: (data as { id: string; name: string }[]) ?? [],
      });
      await get().loadStats();
    } catch {
      /* offline / unauthenticated — leave defaults */
    }
  },

  loadStats: async () => {
    try {
      const supabase = createClient();
      const startToday = new Date();
      startToday.setHours(0, 0, 0, 0);
      const weekAgo = new Date(startToday.getTime() - 6 * 86400000);
      const { data } = await supabase
        .from("study_logs")
        .select("duration_seconds, started_at")
        .eq("kind", "focus")
        .gte("started_at", weekAgo.toISOString());
      let t = 0;
      let w = 0;
      for (const r of (data as { duration_seconds: number; started_at: string }[]) ?? []) {
        w += r.duration_seconds;
        if (new Date(r.started_at) >= startToday) t += r.duration_seconds;
      }
      set({ todaySec: t, weekSec: w });
    } catch {
      /* ignore */
    }
  },

  logStudy: async (seconds) => {
    const { userId, subjectId } = get();
    if (!userId || seconds < 30) return;
    try {
      const supabase = createClient();
      await supabase.from("study_logs").insert({
        user_id: userId,
        subject_id: subjectId || null,
        duration_seconds: Math.round(seconds),
        kind: "focus",
      });
      await get().loadStats();
    } catch {
      /* ignore */
    }
  },

  setSubjectId: (id) => set({ subjectId: id }),
  setView: (v) => set({ view: v }),

  choosePreset: (p) =>
    set({ preset: p, running: false, mode: "focus", secondsLeft: p.focus * 60, endAt: null }),

  applyCustom: (secs) => {
    const p: Preset = { label: "Custom", focus: Math.max(secs, 1) / 60, brk: 5 };
    set({ customSec: secs, preset: p, running: false, mode: "focus", secondsLeft: p.focus * 60, endAt: null });
  },

  toggleRun: () => {
    const s = get();
    if (s.running) {
      set({ running: false, endAt: null });
    } else {
      set({ running: true, endAt: Date.now() + Math.max(0, s.secondsLeft) * 1000 });
    }
  },

  reset: () => {
    const s = get();
    if (s.mode === "focus" && s.running) void s.logStudy(s.preset.focus * 60 - s.secondsLeft);
    set({ running: false, mode: "focus", secondsLeft: s.preset.focus * 60, endAt: null });
  },

  skip: () => {
    const s = get();
    if (s.mode === "focus") void s.logStudy(s.preset.focus * 60 - s.secondsLeft);
    const nextMode: Mode = s.mode === "focus" ? "break" : "focus";
    const nextLeft = (nextMode === "focus" ? s.preset.focus : s.preset.brk) * 60;
    set({
      mode: nextMode,
      secondsLeft: nextLeft,
      endAt: s.running ? Date.now() + nextLeft * 1000 : null,
    });
  },

  tick: () => {
    const s = get();
    // timer
    if (s.running && s.endAt != null) {
      const left = Math.round((s.endAt - Date.now()) / 1000);
      if (left > 0) {
        if (left !== s.secondsLeft) set({ secondsLeft: left });
      } else {
        // phase complete
        playAlarm();
        if (s.mode === "focus") {
          void s.logStudy(s.preset.focus * 60);
          const nextLeft = s.preset.brk * 60;
          set({
            sessions: s.sessions + 1,
            mode: "break",
            secondsLeft: nextLeft,
            endAt: Date.now() + nextLeft * 1000,
          });
        } else {
          const nextLeft = s.preset.focus * 60;
          set({ mode: "focus", secondsLeft: nextLeft, endAt: Date.now() + nextLeft * 1000 });
        }
      }
    }
    // stopwatch
    if (s.swRunning && s.swStart != null) {
      set({ swMs: Date.now() - s.swStart });
    }
  },

  toggleSw: () => {
    const s = get();
    if (s.swRunning) set({ swRunning: false });
    else set({ swRunning: true, swStart: Date.now() - s.swMs });
  },
  resetSw: () => set({ swRunning: false, swMs: 0, laps: [], swStart: null }),
  lap: () => {
    const s = get();
    if (s.swRunning) set({ laps: [s.swMs, ...s.laps] });
  },
}));

export const focusTotal = totalOf;

/** True when there's a live clock the user would want to keep an eye on. */
export const focusIsActive = (s: FocusState) => s.running || s.swRunning;
