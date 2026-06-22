"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { TrendingUp, BarChart3 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { FadeIn } from "@/components/motion/FadeIn";
import { useThemeStore } from "@/stores/theme-store";

type Log = { started_at: string; duration_seconds: number; subject_id: string | null };
type Subj = { id: string; name: string; color: string | null };

const DAYS = 30;
const dayKey = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Theme tokens resolved to concrete colors. recharts writes stroke/fill as SVG
 * *attributes*, where `var(--x)` does NOT resolve — so we read the computed
 * `--token` values off <html> and feed real `hsl()` strings. Re-read whenever
 * the active theme changes so the charts track all nine themes (not a baked-in
 * purple-on-dark that only matched one).
 */
type Tokens = {
  primary: string;
  primarySoft: string;
  foreground: string;
  muted: string;
  grid: string;
  surface: string;
};

const FALLBACK: Tokens = {
  primary: "#7C5CFF",
  primarySoft: "rgba(124,92,255,0.4)",
  foreground: "#e9e9ee",
  muted: "#9a9aa6",
  grid: "rgba(128,128,128,0.18)",
  surface: "#1b1b22",
};

function readTokens(): Tokens {
  if (typeof window === "undefined") return FALLBACK;
  const cs = getComputedStyle(document.documentElement);
  const raw = (name: string) => cs.getPropertyValue(name).trim();
  const hsl = (name: string, alpha?: number, fallback = ""): string => {
    const v = raw(name);
    if (!v) return fallback;
    return alpha == null ? `hsl(${v})` : `hsl(${v} / ${alpha})`;
  };
  return {
    primary: hsl("--primary", undefined, FALLBACK.primary),
    primarySoft: hsl("--primary", 0.4, FALLBACK.primarySoft),
    foreground: hsl("--foreground", undefined, FALLBACK.foreground),
    muted: hsl("--muted", undefined, FALLBACK.muted),
    grid: hsl("--border", 0.7, FALLBACK.grid),
    surface: hsl("--surface", undefined, FALLBACK.surface),
  };
}

/** Resolve tokens during render, recomputed on theme switch. readTokens() is
 *  SSR-safe (returns FALLBACK on the server); the charts only mount once `loading`
 *  flips false — after hydration — so the client-read colors never mismatch SSR. */
function useChartTokens(): Tokens {
  const theme = useThemeStore((s) => s.theme);
  return useMemo(() => {
    void theme; // recompute when the active theme changes — readTokens() reads <html>
    return readTokens();
  }, [theme]);
}

/** App-styled tooltip — surface bg + foreground text, readable on every theme.
 *  recharts injects active/payload/label at runtime; typed locally because
 *  recharts v3's exported TooltipProps no longer surfaces these on the element. */
type TipItem = { value?: number; color?: string; payload?: { color?: string } };
function ChartTooltip({
  active,
  payload,
  label,
  tokens,
  unit,
}: {
  active?: boolean;
  payload?: TipItem[];
  label?: string | number;
  tokens: Tokens;
  unit: string;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  const dot = p.payload?.color ?? p.color ?? tokens.primary;
  return (
    <div
      style={{
        background: tokens.surface,
        border: `1px solid ${tokens.grid}`,
        borderRadius: 12,
        padding: "7px 11px",
        boxShadow: "0 10px 28px -10px rgba(0,0,0,0.5)",
        fontSize: 12,
        lineHeight: 1.35,
      }}
    >
      {label != null && (
        <div style={{ color: tokens.muted, marginBottom: 3, fontSize: 11 }}>{String(label)}</div>
      )}
      <div style={{ color: tokens.foreground, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: 9999, background: dot, flexShrink: 0 }} />
        {p.value} {unit}
      </div>
    </div>
  );
}

/** Recharts insights for the dashboard: focus-time trend + minutes by subject. */
export function StudyCharts() {
  const supabase = useMemo(() => createClient(), []);
  const tokens = useChartTokens();
  const [logs, setLogs] = useState<Log[]>([]);
  const [subjects, setSubjects] = useState<Subj[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const since = new Date();
      since.setHours(0, 0, 0, 0);
      since.setDate(since.getDate() - (DAYS - 1));
      const [{ data: l }, { data: s }] = await Promise.all([
        supabase
          .from("study_logs")
          .select("started_at, duration_seconds, subject_id")
          .eq("kind", "focus")
          .gte("started_at", since.toISOString()),
        supabase.from("subjects").select("id, name, color").is("parent_id", null),
      ]);
      setLogs((l as Log[]) ?? []);
      setSubjects((s as Subj[]) ?? []);
      setLoading(false);
    })();
  }, [supabase]);

  // Daily focus minutes across the window (zero-filled so the trend is continuous).
  const daily = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 0; i < DAYS; i++) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - (DAYS - 1 - i));
      map.set(dayKey(d), 0);
    }
    for (const lg of logs) {
      const k = dayKey(new Date(lg.started_at));
      if (map.has(k)) map.set(k, (map.get(k) ?? 0) + lg.duration_seconds);
    }
    return [...map.entries()].map(([k, secs]) => ({
      day: new Date(k).toLocaleDateString(undefined, { day: "numeric", month: "short" }),
      minutes: Math.round(secs / 60),
    }));
  }, [logs]);

  // Minutes by subject (top 6).
  const bySubject = useMemo(() => {
    const map = new Map<string, number>();
    for (const lg of logs) {
      const id = lg.subject_id ?? "none";
      map.set(id, (map.get(id) ?? 0) + lg.duration_seconds);
    }
    return [...map.entries()]
      .map(([id, secs]) => {
        const s = subjects.find((x) => x.id === id);
        return {
          name: s?.name ?? "Unassigned",
          minutes: Math.round(secs / 60),
          color: s?.color ?? null,
        };
      })
      .filter((d) => d.minutes > 0)
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 6);
  }, [logs, subjects]);

  const totalMin = daily.reduce((a, d) => a + d.minutes, 0);
  if (loading) return <div className="skeleton h-64 w-full rounded-2xl" />;
  if (totalMin === 0) return null; // nothing to chart yet — stay quiet

  return (
    <FadeIn>
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="glass p-5 lg:col-span-3">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Focus this month</h2>
            <span className="ml-auto text-xs text-muted tabular-nums">
              {Math.round(totalMin / 60)}h {totalMin % 60}m total
            </span>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={daily} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="focusFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={tokens.primary} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={tokens.primary} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={tokens.grid} vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 10, fill: tokens.muted }}
                  interval={Math.floor(DAYS / 6)}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis tick={{ fontSize: 10, fill: tokens.muted }} tickLine={false} axisLine={false} width={32} />
                <Tooltip
                  cursor={{ stroke: tokens.grid, strokeWidth: 1 }}
                  content={<ChartTooltip tokens={tokens} unit="min" />}
                />
                <Area type="monotone" dataKey="minutes" stroke={tokens.primary} strokeWidth={2} fill="url(#focusFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass p-5 lg:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">By subject</h2>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bySubject} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 11, fill: tokens.muted }}
                  tickLine={false}
                  axisLine={false}
                  width={92}
                />
                <Tooltip
                  cursor={{ fill: tokens.grid }}
                  content={<ChartTooltip tokens={tokens} unit="min" />}
                />
                <Bar dataKey="minutes" radius={[0, 6, 6, 0]}>
                  {bySubject.map((d, i) => (
                    <Cell key={i} fill={d.color ?? tokens.primary} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </FadeIn>
  );
}
