"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Copy, Check, Send, Play, Coffee, Square, Trash2, LogOut, UserMinus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { CoworkRoom as Room, CoworkMessage } from "@/types/db";
import { cn } from "@/lib/utils";
import { useErrorStore } from "@/stores/error-store";
import { AppError } from "@/lib/errors";
import { StatusDot } from "@/features/coworking/StatusDot";
import { getProfiles, type PresenceStatus } from "@/features/coworking/social";

interface Props {
  roomId: string;
  userId: string;
  displayName: string;
  onLeave: () => void;
}

interface Present {
  user_id: string;
  name: string;
}

const FOCUS_SECS = 25 * 60;
const BREAK_SECS = 5 * 60;

function mmss(total: number) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** A single co-study room: live presence, chat, and a shared synced focus timer. */
export function CoworkRoom({ roomId, userId, displayName, onLeave }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [room, setRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<CoworkMessage[]>([]);
  const [present, setPresent] = useState<Present[]>([]);
  const [roster, setRoster] = useState<
    Record<string, { avatar_url: string | null; status: PresenceStatus }>
  >({});
  const [draft, setDraft] = useState("");
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const scrollRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Append a message unless we already have it (de-dupe across broadcast,
  // postgres_changes, and the optimistic local add — all share the row id).
  const addMessage = (m: CoworkMessage) =>
    setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));

  // Initial load.
  useEffect(() => {
    let alive = true;
    (async () => {
      const [{ data: r }, { data: m }] = await Promise.all([
        supabase.from("cowork_rooms").select("*").eq("id", roomId).single(),
        supabase
          .from("cowork_messages")
          .select("*")
          .eq("room_id", roomId)
          .order("created_at", { ascending: true })
          .limit(100),
      ]);
      if (!alive) return;
      if (r) setRoom(r as Room);
      if (m) setMessages(m as CoworkMessage[]);
    })();
    return () => {
      alive = false;
    };
  }, [supabase, roomId]);

  // Realtime: presence + chat inserts + room (timer) updates, one channel.
  useEffect(() => {
    const channel = supabase.channel(`cowork:${roomId}`, {
      config: { presence: { key: userId } },
    });
    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<Present>();
        const seen = new Map<string, Present>();
        for (const list of Object.values(state)) {
          for (const p of list) seen.set(p.user_id, { user_id: p.user_id, name: p.name });
        }
        setPresent([...seen.values()]);
      })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "cowork_messages", filter: `room_id=eq.${roomId}` },
        (payload) => addMessage(payload.new as CoworkMessage),
      )
      // Broadcast is the primary live path: it delivers to everyone on the
      // channel instantly and does NOT depend on the realtime publication or
      // RLS being perfectly configured (postgres_changes above does). Belt and
      // suspenders — both are de-duped by row id.
      .on("broadcast", { event: "msg" }, ({ payload }) => addMessage(payload as CoworkMessage))
      // Shared timer also syncs over broadcast (instant, no dependency on the
      // postgres_changes UPDATE being delivered — that's why Pomodoro looked dead).
      .on("broadcast", { event: "timer" }, ({ payload }) =>
        setRoom((r) =>
          r
            ? {
                ...r,
                timer_phase: payload.timer_phase,
                timer_started_at: payload.timer_started_at,
                timer_duration_secs: payload.timer_duration_secs,
              }
            : r,
        ),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "cowork_rooms", filter: `id=eq.${roomId}` },
        (payload) => setRoom(payload.new as Room),
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") channel.track({ user_id: userId, name: displayName });
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          useErrorStore.getState().report(
            new AppError({
              title: "Live sync unavailable",
              source: "Coworking · realtime",
              systemMessage: `Realtime channel status: ${status}`,
              hint: "Chat and presence won't update live. The coworking tables may not be in the Supabase realtime publication — re-run supabase/migrations/2026-06-16_coworking.sql, then reload.",
            }),
            "Coworking · realtime",
          );
        }
      });
    channelRef.current = channel;
    return () => {
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [supabase, roomId, userId, displayName]);

  // Timer tick.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Keep chat pinned to the latest message.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  // Enrich the live roster with real identities (avatar + presence status).
  // Keyed on the sorted id set so we only refetch when who's-here actually
  // changes, not on every presence sync tick.
  const presentKey = useMemo(
    () => present.map((p) => p.user_id).sort().join(","),
    [present],
  );
  useEffect(() => {
    const ids = presentKey ? presentKey.split(",") : [];
    if (!ids.length) return;
    let alive = true;
    getProfiles(ids)
      .then((profs) => {
        if (!alive) return;
        const map: Record<string, { avatar_url: string | null; status: PresenceStatus }> = {};
        for (const p of profs) map[p.id] = { avatar_url: p.avatar_url, status: p.status };
        setRoster(map);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [presentKey]);

  const running = room ? room.timer_phase !== "idle" : false;
  const elapsed = room?.timer_started_at
    ? Math.floor((now - new Date(room.timer_started_at).getTime()) / 1000)
    : 0;
  const remaining = room ? Math.max(0, room.timer_duration_secs - elapsed) : 0;

  const setTimer = async (phase: "idle" | "focus" | "break", secs: number) => {
    const started_at = phase === "idle" ? null : new Date().toISOString();
    // Optimistic locally + broadcast live to the room, then persist via RPC.
    setRoom((r) =>
      r ? { ...r, timer_phase: phase, timer_started_at: started_at, timer_duration_secs: secs } : r,
    );
    channelRef.current?.send({
      type: "broadcast",
      event: "timer",
      payload: { timer_phase: phase, timer_started_at: started_at, timer_duration_secs: secs },
    });
    const { error } = await supabase.rpc("set_cowork_timer", {
      p_room: roomId,
      p_phase: phase,
      p_started_at: started_at,
      p_duration: secs,
    });
    if (error) {
      useErrorStore.getState().report(
        new AppError({
          title: "Timer not saved",
          source: "Coworking · timer",
          systemMessage: `${error.message} (code ${error.code ?? "?"})`,
          hint: "Everyone saw it live, but it won't survive a reload. Usually a membership/RLS issue.",
        }),
        "Coworking · timer",
      );
    }
  };

  const send = async () => {
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    // One shared id across optimistic add, broadcast, persistence and the
    // postgres_changes echo so every path de-dupes to a single bubble.
    const msg: CoworkMessage = {
      id: crypto.randomUUID(),
      room_id: roomId,
      user_id: userId,
      author_name: displayName,
      body,
      created_at: new Date().toISOString(),
    };
    // 1) Show it locally + push live to everyone on the channel immediately.
    addMessage(msg);
    channelRef.current?.send({ type: "broadcast", event: "msg", payload: msg });
    // 2) Persist for history (best-effort — live delivery already happened).
    const { error } = await supabase.from("cowork_messages").insert(msg);
    if (error) {
      useErrorStore.getState().report(
        new AppError({
          title: "Message sent live but not saved",
          source: "Coworking · chat",
          systemMessage: `${error.message}${error.details ? `\n${error.details}` : ""}${
            error.hint ? `\n${error.hint}` : ""
          } (code ${error.code ?? "?"})`,
          hint: "Others saw it live, but it won't survive a reload. This usually means the coworking migration isn't fully applied — run supabase/migrations/2026-06-16_coworking.sql in Supabase.",
        }),
        "Coworking · chat",
      );
    }
  };

  const copyCode = async () => {
    if (!room) return;
    await navigator.clipboard.writeText(room.join_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const leave = async () => {
    await supabase.from("cowork_members").delete().eq("room_id", roomId).eq("user_id", userId);
    onLeave();
  };

  const deleteRoom = async () => {
    await supabase.from("cowork_rooms").delete().eq("id", roomId);
    onLeave();
  };

  const kick = async (uid: string) => {
    await supabase.from("cowork_members").delete().eq("room_id", roomId).eq("user_id", uid);
  };

  const isOwner = room?.owner_id === userId;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={onLeave} className="neu-btn grid h-9 w-9 place-items-center rounded-full" aria-label="Back">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight">{room?.name ?? "Room"}</h1>
          <p className="text-xs text-muted">
            {present.length} here · {room?.is_private ? "private" : "public"}
          </p>
        </div>
        <button
          onClick={copyCode}
          className="neu-btn ml-auto flex h-9 items-center gap-2 rounded-full px-3 text-sm"
          title="Copy invite code"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
          <span className="font-mono tracking-widest">{room?.join_code ?? "······"}</span>
        </button>
        {isOwner ? (
          <button onClick={deleteRoom} className="neu-btn grid h-9 w-9 place-items-center rounded-full text-warning" title="Delete room">
            <Trash2 className="h-4 w-4" />
          </button>
        ) : (
          <button onClick={leave} className="neu-btn grid h-9 w-9 place-items-center rounded-full" title="Leave room">
            <LogOut className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        {/* Shared timer + presence */}
        <div className="flex flex-col gap-4">
          <div className="glass flex flex-col items-center gap-4 p-6">
            <span className="text-xs uppercase tracking-[0.2em] text-muted">
              {room?.timer_phase === "focus" ? "Focusing together" : room?.timer_phase === "break" ? "On a break" : "Shared timer"}
            </span>
            <span className={cn("font-mono text-6xl font-semibold tabular-nums", running && "text-primary")}>
              {mmss(running ? remaining : room?.timer_duration_secs ?? FOCUS_SECS)}
            </span>
            <div className="flex items-center gap-2">
              <button onClick={() => setTimer("focus", FOCUS_SECS)} className="neu-btn flex h-10 items-center gap-2 rounded-full px-4 text-sm">
                <Play className="h-4 w-4 text-primary" /> Focus
              </button>
              <button onClick={() => setTimer("break", BREAK_SECS)} className="neu-btn flex h-10 items-center gap-2 rounded-full px-4 text-sm">
                <Coffee className="h-4 w-4" /> Break
              </button>
              <button onClick={() => setTimer("idle", room?.timer_duration_secs ?? FOCUS_SECS)} className="neu-btn grid h-10 w-10 place-items-center rounded-full" aria-label="Stop">
                <Square className="h-4 w-4" />
              </button>
            </div>
            <p className="text-center text-xs text-muted">Anyone in the room can start or stop the timer — everyone stays in sync.</p>
          </div>

          <div className="glass p-4">
            <p className="mb-3 text-sm font-semibold tracking-tight">Here now</p>
            <div className="flex flex-wrap gap-2">
              {present.length === 0 && <p className="text-sm text-muted">Just getting started…</p>}
              {present.map((p) => {
                const prof = roster[p.user_id];
                return (
                  <span key={p.user_id} className="neu flex items-center gap-2 rounded-full py-1 pl-1 pr-3">
                    <span className="relative shrink-0">
                      {prof?.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={prof.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover" />
                      ) : (
                        <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-primary to-secondary text-xs font-semibold text-primary-foreground">
                          {(p.name || "?").charAt(0).toUpperCase()}
                        </span>
                      )}
                      <StatusDot
                        status={prof?.status ?? "online"}
                        ring
                        className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5"
                      />
                    </span>
                    <span className="text-sm">{p.user_id === userId ? "You" : p.name}</span>
                    {isOwner && p.user_id !== userId && (
                      <button onClick={() => kick(p.user_id)} className="text-muted hover:text-warning" title="Remove">
                        <UserMinus className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        {/* Chat */}
        <div className="glass flex h-[28rem] flex-col p-0">
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-auto p-4">
            {messages.length === 0 && <p className="text-sm text-muted">No messages yet — say hi 👋</p>}
            {messages.map((m) => {
              const mine = m.user_id === userId;
              return (
                <div key={m.id} className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
                  {!mine && <span className="mb-0.5 px-1 text-[11px] text-muted">{m.author_name}</span>}
                  <span className={cn("max-w-[85%] rounded-2xl px-3 py-2 text-sm", mine ? "bg-primary text-primary-foreground" : "neu")}>
                    {m.body}
                  </span>
                </div>
              );
            })}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex items-center gap-2 border-t border-border/60 p-3"
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Message the room…"
              className="field flex-1 rounded-full px-4 py-2 text-sm"
              aria-label="Message"
            />
            <button type="submit" disabled={!draft.trim()} className="pressable grid h-9 w-9 shrink-0 place-items-center rounded-full text-primary disabled:opacity-40" aria-label="Send">
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
