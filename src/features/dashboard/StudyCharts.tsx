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

type Log = { started_at: string; duration_seconds: number; subject_id: string | null };
type Subj = { id: string; name: string; color: string | null };

const DAYS = 30;
const dayKey = (d: Date) => d.toISOString().slice(0, 10);

/** Recharts insights for the dashboard: focus-time trend + minutes by subject. */
export function StudyCharts() {
  const supabase = useMemo(() => createClient(), []);
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
          color: s?.color ?? "#7C5CFF",
        };
      })
      .filter((d) => d.minutes > 0)
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 6);
  }, [logs, subjects]);

  const totalMin = daily.reduce((a, d) => a + d.minutes, 0);
  if (loading) return <div className="skeleton h-64 w-full rounded-2xl" />;
  if (totalMin === 0) return null; // nothing to chart yet — stay quiet

  const tooltip = {
    contentStyle: {
      background: "var(--card, #1a1a1a)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 12,
      fontSize: 12,
    },
    labelStyle: { color: "var(--muted, #999)" },
  };

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
                    <stop offset="0%" stopColor="#7C5CFF" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#7C5CFF" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 10, fill: "var(--muted, #999)" }}
                  interval={Math.floor(DAYS / 6)}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis tick={{ fontSize: 10, fill: "var(--muted, #999)" }} tickLine={false} axisLine={false} width={32} />
                <Tooltip {...tooltip} formatter={(value) => [`${Number(value)} min`, "Focus"]} />
                <Area type="monotone" dataKey="minutes" stroke="#7C5CFF" strokeWidth={2} fill="url(#focusFill)" />
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
                  tick={{ fontSize: 11, fill: "var(--muted, #999)" }}
                  tickLine={false}
                  axisLine={false}
                  width={92}
                />
                <Tooltip {...tooltip} cursor={{ fill: "rgba(255,255,255,0.04)" }} formatter={(value) => [`${Number(value)} min`, "Focus"]} />
                <Bar dataKey="minutes" radius={[0, 6, 6, 0]}>
                  {bySubject.map((d, i) => (
                    <Cell key={i} fill={d.color} />
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
