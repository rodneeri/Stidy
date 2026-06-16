"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Play, Pause, RotateCcw, SkipForward, Volume2, Timer, Watch, Flag } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { NeuSlider } from "@/components/ui/NeuSlider";
import { Dropdown } from "@/components/ui/Dropdown";
import { cn } from "@/lib/utils";

type Mode = "focus" | "break";
type Noise = "off" | "white" | "pink" | "brown";
type View = "timer" | "stopwatch";
type Preset = { label: string; focus: number; brk: number };

const PRESETS: Preset[] = [
  { label: "Pomodoro", focus: 25, brk: 5 },
  { label: "Deep work", focus: 50, brk: 10 },
];
const NOISES: { id: Noise; label: string }[] = [
  { id: "off", label: "Off" },
  { id: "pink", label: "Rain" },
  { id: "brown", label: "Waves" },
  { id: "white", label: "Hush" },
];
const CUTOFF: Record<Noise, number> = { off: 0, white: 1100, pink: 2200, brown: 520 };

const mmss = (s: number) => {
  const sec = Math.max(0, s);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const ss = sec % 60;
  return h > 0
    ? `${h}:${m.toString().padStart(2, "0")}:${ss.toString().padStart(2, "0")}`
    : `${m.toString().padStart(2, "0")}:${ss.toString().padStart(2, "0")}`;
};

/** Editable HH/MM/SS segment inside the timer ring — type, scroll, or ↑/↓. */
function TimeSeg({
  value,
  max,
  label,
  onSet,
}: {
  value: number;
  max: number;
  label: string;
  onSet: (v: number) => void;
}) {
  const norm = (v: number) => ((v % (max + 1)) + (max + 1)) % (max + 1);
  return (
    <div className="flex flex-col items-center gap-1">
      <input
        inputMode="numeric"
        value={value.toString().padStart(2, "0")}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => {
          const n = parseInt(e.target.value.replace(/\D/g, "").slice(-2) || "0", 10);
          onSet(Math.min(max, n));
        }}
        onWheel={(e) => onSet(norm(value + (e.deltaY < 0 ? 1 : -1)))}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp") {
            e.preventDefault();
            onSet(norm(value + 1));
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            onSet(norm(value - 1));
          }
        }}
        aria-label={label}
        className="field w-12 cursor-ns-resize rounded-lg py-1 text-center text-2xl font-semibold tabular-nums outline-none focus:text-primary"
      />
      <span className="text-[9px] font-medium uppercase tracking-wide text-muted">{label}</span>
    </div>
  );
}

const mmsscs = (ms: number) => {
  const t = Math.floor(ms / 10);
  const cs = t % 100;
  const s = Math.floor(t / 100) % 60;
  const m = Math.floor(t / 6000);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}.${cs
    .toString()
    .padStart(2, "0")}`;
};
const hours = (s: number) => `${(s / 3600).toFixed(1)}h`;

function playAlarm() {
  try {
    const ctx = new AudioContext();
    const master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);

    // A soft bell: fundamental + a quiet octave shimmer, gentle attack, long decay.
    const bell = (t: number, freq: number, dur: number, vol: number) => {
      const o = ctx.createOscillator();
      const o2 = ctx.createOscillator();
      const g = ctx.createGain();
      const g2 = ctx.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      o2.type = "sine";
      o2.frequency.value = freq * 2.01; // slightly detuned octave = shimmer
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

    // A calm major arpeggio (C5–E5–G5), repeated a few times — relaxed but persistent.
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

function fillNoise(buf: AudioBuffer, type: Noise) {
  const d = buf.getChannelData(0);
  if (type === "brown") {
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    }
  } else if (type === "pink") {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
  } else {
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
}

export function FocusTimer() {
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [subjectId, setSubjectId] = useState("");

  const [view, setView] = useState<View>("timer");
  const [preset, setPreset] = useState<Preset>(PRESETS[0]);
  const [customSec, setCustomSec] = useState(25 * 60);
  const [mode, setMode] = useState<Mode>("focus");
  const [secondsLeft, setSecondsLeft] = useState(PRESETS[0].focus * 60);
  const [running, setRunning] = useState(false);
  const [sessions, setSessions] = useState(0);
  const [phaseId, setPhaseId] = useState(0); // bumps on each new phase so the timer re-arms

  const [todaySec, setTodaySec] = useState(0);
  const [weekSec, setWeekSec] = useState(0);

  const [noise, setNoise] = useState<Noise>("off");
  const [volume, setVolume] = useState(0.4);

  // stopwatch
  const [swMs, setSwMs] = useState(0);
  const [swRunning, setSwRunning] = useState(false);
  const [laps, setLaps] = useState<number[]>([]);
  const swStartRef = useRef<number | null>(null);

  const total = (mode === "focus" ? preset.focus : preset.brk) * 60;
  const audioRef = useRef<{ ctx: AudioContext; src: AudioBufferSourceNode; gain: GainNode } | null>(null);
  const endAtRef = useRef<number | null>(null); // target end timestamp (ms) while running
  const secLeftRef = useRef(secondsLeft);
  secLeftRef.current = secondsLeft;

  const loadStats = useCallback(async () => {
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
    setTodaySec(t);
    setWeekSec(w);
  }, [supabase]);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      const { data } = await supabase.from("subjects").select("id, name").is("parent_id", null).order("name");
      setSubjects((data as { id: string; name: string }[]) ?? []);
      await loadStats();
    })();
  }, [supabase, loadStats]);

  const logStudy = useCallback(
    async (seconds: number) => {
      if (!userId || seconds < 30) return;
      await supabase.from("study_logs").insert({
        user_id: userId,
        subject_id: subjectId || null,
        duration_seconds: Math.round(seconds),
        kind: "focus",
      });
      await loadStats();
    },
    [supabase, userId, subjectId, loadStats],
  );

  // countdown — driven by a target timestamp, not by counting ticks, so it stays
  // accurate when the tab is backgrounded (browsers throttle setInterval there)
  // and the session still completes/logs when you return. Re-syncs on focus/visibility.
  useEffect(() => {
    if (!running) {
      endAtRef.current = null;
      return;
    }
    endAtRef.current = Date.now() + secLeftRef.current * 1000;
    const tick = () => {
      if (endAtRef.current != null) setSecondsLeft(Math.round((endAtRef.current - Date.now()) / 1000));
    };
    const id = setInterval(tick, 1000);
    const onVisible = () => {
      if (!document.hidden) tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [running, phaseId]);

  // phase completion (+ alarm)
  useEffect(() => {
    if (secondsLeft > 0) return;
    playAlarm();
    if (mode === "focus") {
      logStudy(preset.focus * 60);
      setSessions((n) => n + 1);
      setMode("break");
      setSecondsLeft(preset.brk * 60);
    } else {
      setMode("focus");
      setSecondsLeft(preset.focus * 60);
    }
    setPhaseId((p) => p + 1); // re-arm the timestamp timer for the new phase
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft]);

  // stopwatch tick
  useEffect(() => {
    if (!swRunning) return;
    const id = setInterval(() => {
      if (swStartRef.current != null) setSwMs(Date.now() - swStartRef.current);
    }, 47);
    return () => clearInterval(id);
  }, [swRunning]);

  function resetTimer() {
    if (mode === "focus" && running) logStudy(preset.focus * 60 - secondsLeft);
    setRunning(false);
    setMode("focus");
    setSecondsLeft(preset.focus * 60);
  }
  function skip() {
    if (mode === "focus") logStudy(preset.focus * 60 - secondsLeft);
    setMode((m) => (m === "focus" ? "break" : "focus"));
    setSecondsLeft((mode === "focus" ? preset.brk : preset.focus) * 60);
    setPhaseId((p) => p + 1);
  }
  function choosePreset(p: Preset) {
    setPreset(p);
    setRunning(false);
    setMode("focus");
    setSecondsLeft(p.focus * 60);
  }
  function applyCustom(secs: number) {
    setCustomSec(secs);
    choosePreset({ label: "Custom", focus: Math.max(secs, 1) / 60, brk: 5 });
  }

  function toggleSw() {
    if (swRunning) {
      setSwRunning(false);
    } else {
      swStartRef.current = Date.now() - swMs;
      setSwRunning(true);
    }
  }
  function resetSw() {
    setSwRunning(false);
    setSwMs(0);
    setLaps([]);
    swStartRef.current = null;
  }

  // ambience (Web Audio, no assets)
  const stopNoise = useCallback(() => {
    if (audioRef.current) {
      try {
        audioRef.current.src.stop();
      } catch {}
      audioRef.current.ctx.close();
      audioRef.current = null;
    }
  }, []);

  useEffect(() => {
    stopNoise();
    if (noise === "off") return;
    const ctx = new AudioContext();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    fillNoise(buf, noise);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = CUTOFF[noise];
    filter.Q.value = 0.6;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(Math.max(volume * 0.5, 0.0001), ctx.currentTime + 0.4);
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start();
    audioRef.current = { ctx, src, gain };
    return () => stopNoise();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noise]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.gain.gain.value = Math.max(volume * 0.5, 0.0001);
  }, [volume]);

  useEffect(() => () => stopNoise(), [stopNoise]);

  const pct = total > 0 ? ((total - secondsLeft) / total) * 100 : 0;
  const overworked = todaySec > 4 * 3600;
  const editingCustom = preset.label === "Custom" && !running;
  const cH = Math.floor(customSec / 3600);
  const cM = Math.floor((customSec % 3600) / 60);
  const cS = customSec % 60;

  const tab = (v: View, label: string, Icon: typeof Timer) => (
    <button
      onClick={() => setView(v)}
      className={cn(
        "pressable flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium",
        view === v ? "neu text-primary" : "text-muted hover:text-foreground",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="display-3">Focus</h1>
        <p className="mt-1 text-sm text-muted">Deep-work timer, stopwatch, study logging and ambience.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Timer / Stopwatch */}
        <div className="glass flex flex-col items-center gap-6 p-8">
          <div className="flex gap-2">
            {tab("timer", "Timer", Timer)}
            {tab("stopwatch", "Stopwatch", Watch)}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="flex w-full flex-col items-center gap-6"
            >
              {view === "timer" ? (
            <>
              <div className="flex flex-wrap justify-center gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => choosePreset(p)}
                    className={cn(
                      "pressable rounded-full px-3 py-1.5 text-xs font-medium",
                      preset.label === p.label ? "neu text-primary" : "text-muted hover:text-foreground",
                    )}
                  >
                    {p.label}
                  </button>
                ))}
                <button
                  onClick={() => applyCustom(customSec)}
                  className={cn(
                    "pressable rounded-full px-3 py-1.5 text-xs font-medium",
                    preset.label === "Custom" ? "neu text-primary" : "text-muted hover:text-foreground",
                  )}
                >
                  Custom
                </button>
              </div>

              <div className="dial h-56 w-56">
                <div
                  className={cn(
                    "pointer-events-none absolute inset-0 rounded-full",
                    running && !editingCustom && "breathe-soft",
                  )}
                  style={{
                    background: `conic-gradient(from -90deg, ${
                      mode === "focus" ? "hsl(var(--primary))" : "hsl(var(--secondary))"
                    } ${editingCustom ? 100 : pct}%, transparent ${editingCustom ? 100 : pct}%)`,
                    WebkitMask:
                      "radial-gradient(farthest-side, #0000 calc(100% - 15px), #000 calc(100% - 14.5px))",
                    mask: "radial-gradient(farthest-side, #0000 calc(100% - 15px), #000 calc(100% - 14.5px))",
                    filter: `drop-shadow(0 0 9px ${
                      mode === "focus" ? "hsl(var(--primary) / 0.85)" : "hsl(var(--secondary) / 0.85)"
                    })`,
                  }}
                />
                <div className="dial__cap" style={{ width: 200, height: 200 }}>
                  {editingCustom ? (
                    <div className="text-center">
                      <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted">Set timer</p>
                      <div className="flex items-center justify-center gap-1">
                        <TimeSeg value={cH} max={23} label="hr" onSet={(v) => applyCustom(v * 3600 + cM * 60 + cS)} />
                        <span className="-mt-3 text-2xl font-semibold text-muted">:</span>
                        <TimeSeg value={cM} max={59} label="min" onSet={(v) => applyCustom(cH * 3600 + v * 60 + cS)} />
                        <span className="-mt-3 text-2xl font-semibold text-muted">:</span>
                        <TimeSeg value={cS} max={59} label="sec" onSet={(v) => applyCustom(cH * 3600 + cM * 60 + v)} />
                      </div>
                      <p className="mt-1.5 text-[10px] text-muted">type · scroll · ↑↓</p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted">{mode}</p>
                      <p className="text-5xl font-semibold tabular-nums">{mmss(secondsLeft)}</p>
                      <p className="mt-1 text-xs text-muted">{sessions} sessions today</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setRunning((r) => !r)}
                  className="neu-btn grid h-14 w-14 place-items-center rounded-full text-primary"
                  aria-label={running ? "Pause" : "Start"}
                >
                  {running ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
                </button>
                <button onClick={skip} className="neu-btn grid h-11 w-11 place-items-center rounded-full" aria-label="Skip">
                  <SkipForward className="h-5 w-5" />
                </button>
                <button onClick={resetTimer} className="neu-btn grid h-11 w-11 place-items-center rounded-full" aria-label="Reset">
                  <RotateCcw className="h-5 w-5" />
                </button>
              </div>

              <Dropdown
                value={subjectId}
                options={[
                  { value: "", label: "Log to: no subject" },
                  ...subjects.map((s) => ({ value: s.id, label: `Log to: ${s.name}` })),
                ]}
                onChange={setSubjectId}
                className="w-56"
                up
              />
            </>
          ) : (
            <>
              <div className="grid h-56 w-56 place-items-center rounded-full neu-inset">
                <p className="text-4xl font-semibold tabular-nums">{mmsscs(swMs)}</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={toggleSw}
                  className="neu-btn grid h-14 w-14 place-items-center rounded-full text-primary"
                  aria-label={swRunning ? "Pause" : "Start"}
                >
                  {swRunning ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
                </button>
                <button
                  onClick={() => swRunning && setLaps((l) => [swMs, ...l])}
                  disabled={!swRunning}
                  className="neu-btn grid h-11 w-11 place-items-center rounded-full disabled:opacity-40"
                  aria-label="Lap"
                >
                  <Flag className="h-5 w-5" />
                </button>
                <button onClick={resetSw} className="neu-btn grid h-11 w-11 place-items-center rounded-full" aria-label="Reset">
                  <RotateCcw className="h-5 w-5" />
                </button>
              </div>
              {laps.length > 0 && (
                <div className="max-h-40 w-full max-w-xs space-y-1 overflow-auto">
                  {laps.map((l, i) => (
                    <div key={i} className="flex justify-between rounded-lg px-3 py-1.5 text-sm text-muted">
                      <span>Lap {laps.length - i}</span>
                      <span className="tabular-nums">{mmsscs(l)}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Side: stats + ambience */}
        <div className="space-y-6">
          <div className="glass space-y-3 p-5">
            <h2 className="font-semibold">Study hours</h2>
            <div className="flex gap-4">
              <div>
                <p className="text-xs text-muted">Today</p>
                <p className="text-2xl font-semibold tabular-nums">{hours(todaySec)}</p>
              </div>
              <div>
                <p className="text-xs text-muted">This week</p>
                <p className="text-2xl font-semibold tabular-nums">{hours(weekSec)}</p>
              </div>
            </div>
            {overworked && (
              <p className="rounded-lg bg-warning/15 px-3 py-2 text-sm text-warning">
                You&apos;ve studied 4h+ today — consider a longer break. 🌿
              </p>
            )}
          </div>

          <div className="glass space-y-4 p-5">
            <div className="flex items-center gap-2">
              <Volume2 className="h-4 w-4 text-primary" />
              <h2 className="font-semibold">Ambience</h2>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {NOISES.map((nz) => (
                <button
                  key={nz.id}
                  onClick={() => setNoise(nz.id)}
                  className={cn(
                    "pressable rounded-lg py-2 text-xs font-medium",
                    noise === nz.id ? "neu text-primary" : "neu-inset text-muted",
                  )}
                >
                  {nz.label}
                </button>
              ))}
            </div>
            <div>
              <p className="text-xs text-muted">Volume</p>
              <NeuSlider
                value={Math.round(volume * 100)}
                onChange={(v) => setVolume(v / 100)}
                format={(v) => `${v}%`}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
