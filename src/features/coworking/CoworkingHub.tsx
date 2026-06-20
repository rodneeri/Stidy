"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Users, Plus, LogIn, Lock, Globe, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { CoworkRoom as Room } from "@/types/db";
import { FadeIn } from "@/components/motion/FadeIn";
import { cn } from "@/lib/utils";
import { isMissingTable } from "@/features/coworking/util";
import { CoworkRoom } from "@/features/coworking/CoworkRoom";

interface Props {
  userId: string;
  displayName: string;
}

/** Coworking lobby: create/join rooms, browse public ones, then drop into a room. */
export function CoworkingHub({ userId, displayName }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [notReady, setNotReady] = useState(false);
  const [myRooms, setMyRooms] = useState<Room[]>([]);
  const [publicRooms, setPublicRooms] = useState<Room[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [isPrivate, setIsPrivate] = useState(true);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lobbyRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: mem }, { data: rooms, error: roomsErr }] = await Promise.all([
      supabase.from("cowork_members").select("room_id").eq("user_id", userId),
      supabase.from("cowork_rooms").select("*").order("created_at", { ascending: false }),
    ]);
    if (roomsErr) {
      if (isMissingTable(roomsErr)) setNotReady(true);
      setLoading(false);
      return;
    }
    const memberIds = new Set((mem ?? []).map((m) => m.room_id as string));
    const all = (rooms ?? []) as Room[];
    setMyRooms(all.filter((r) => memberIds.has(r.id) || r.owner_id === userId));
    setPublicRooms(all.filter((r) => !r.is_private && !memberIds.has(r.id) && r.owner_id !== userId));
    setLoading(false);
  }, [supabase, userId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  // Live lobby: new public rooms appear without a reload. postgres_changes is
  // the main path; a broadcast on create is the resilient fallback (works even
  // if the realtime publication isn't configured yet). setState here is driven
  // by realtime callbacks (an external system) — the intended pattern.
  useEffect(() => {
    const addPublic = (r: Room) => {
      if (r.is_private || r.owner_id === userId) return;
      setPublicRooms((prev) => (prev.some((x) => x.id === r.id) ? prev : [r, ...prev]));
    };
    const channel = supabase
      .channel("cowork:lobby")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "cowork_rooms" },
        (payload) => addPublic(payload.new as Room),
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "cowork_rooms" },
        (payload) => {
          const id = (payload.old as { id: string }).id;
          setPublicRooms((prev) => prev.filter((x) => x.id !== id));
          setMyRooms((prev) => prev.filter((x) => x.id !== id));
        },
      )
      .on("broadcast", { event: "room" }, ({ payload }) => addPublic(payload as Room))
      .subscribe();
    lobbyRef.current = channel;
    return () => {
      lobbyRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [supabase, userId]);

  const createRoom = async () => {
    const n = name.trim();
    if (!n || busy) return;
    setBusy(true);
    setError(null);
    const { data, error: e } = await supabase
      .from("cowork_rooms")
      .insert({ owner_id: userId, name: n, is_private: isPrivate })
      .select("*")
      .single();
    setBusy(false);
    if (e) {
      setError(isMissingTable(e) ? "Coworking isn't enabled yet." : e.message);
      return;
    }
    setName("");
    if (data) {
      // Tell other lobbies live (resilient fallback to postgres_changes).
      // Guarded: a not-yet-subscribed channel must never block entering the room.
      if (!(data as Room).is_private) {
        try {
          void lobbyRef.current?.send({ type: "broadcast", event: "room", payload: data });
        } catch {
          /* non-fatal */
        }
      }
      setActiveRoomId((data as Room).id);
    }
  };

  const joinByCode = async (raw?: string) => {
    const c = (raw ?? code).trim();
    if (!c || busy) return;
    setBusy(true);
    setError(null);
    const { data, error: e } = await supabase.rpc("join_cowork_room", { p_code: c });
    setBusy(false);
    if (e) {
      setError(/not found/i.test(e.message) ? "No room with that code." : e.message);
      return;
    }
    setCode("");
    if (data) setActiveRoomId(data as string);
  };

  if (activeRoomId) {
    return (
      <CoworkRoom
        roomId={activeRoomId}
        userId={userId}
        displayName={displayName}
        onLeave={() => {
          setActiveRoomId(null);
          load();
        }}
      />
    );
  }

  return (
    <FadeIn>
      <header className="mb-8">
        <h1 className="breathe-title flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Users className="h-6 w-6 text-primary" /> Coworking
        </h1>
        <p className="mt-1 text-muted">Study together — live rooms, a shared focus timer, and chat.</p>
      </header>

      {notReady ? (
        <div className="glass flex min-h-[260px] flex-col items-center justify-center gap-3 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/15 text-primary">
            <Users className="h-6 w-6" />
          </div>
          <p className="font-medium">Coworking is rolling out</p>
          <p className="max-w-sm text-sm text-muted">
            A quick database migration is pending. Once it&apos;s applied, rooms light up here.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Create / Join */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="glass p-5">
              <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><Plus className="h-4 w-4 text-primary" /> New room</p>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Room name (e.g. Cálculo grind)"
                className="field mb-3 w-full rounded-lg px-3 py-2 text-sm"
              />
              <div className="mb-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsPrivate(true)}
                  className={cn("flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm", isPrivate ? "neu text-primary" : "field text-muted")}
                >
                  <Lock className="h-3.5 w-3.5" /> Private
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrivate(false)}
                  className={cn("flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm", !isPrivate ? "neu text-primary" : "field text-muted")}
                >
                  <Globe className="h-3.5 w-3.5" /> Public
                </button>
              </div>
              <button onClick={createRoom} disabled={!name.trim() || busy} className="neu-btn w-full rounded-lg py-2 text-sm font-medium text-primary disabled:opacity-40">
                Create &amp; enter
              </button>
            </div>

            <div className="glass p-5">
              <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><LogIn className="h-4 w-4 text-primary" /> Join with a code</p>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ABC123"
                className="field mb-3 w-full rounded-lg px-3 py-2 font-mono text-sm tracking-widest"
                onKeyDown={(e) => e.key === "Enter" && joinByCode()}
              />
              <button onClick={() => joinByCode()} disabled={!code.trim() || busy} className="neu-btn w-full rounded-lg py-2 text-sm font-medium text-primary disabled:opacity-40">
                Join room
              </button>
              {error && <p className="mt-2 text-xs text-warning">{error}</p>}
            </div>
          </div>

          {/* My rooms */}
          <section>
            <h2 className="mb-3 text-sm font-semibold tracking-tight text-muted">Your rooms</h2>
            {loading ? (
              <p className="text-sm text-muted">Loading…</p>
            ) : myRooms.length === 0 ? (
              <p className="text-sm text-muted">No rooms yet — create one or join with a code.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {myRooms.map((r) => (
                  <button key={r.id} onClick={() => setActiveRoomId(r.id)} className="neu lift group flex items-center justify-between gap-3 rounded-2xl p-4 text-left">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{r.name}</span>
                      <span className="flex items-center gap-1 text-xs text-muted">
                        {r.is_private ? <Lock className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
                        {r.is_private ? "private" : "public"}
                      </span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Discover */}
          {publicRooms.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold tracking-tight text-muted">Discover public rooms</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {publicRooms.map((r) => (
                  <button key={r.id} onClick={() => joinByCode(r.join_code)} className="neu lift group flex items-center justify-between gap-3 rounded-2xl p-4 text-left">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{r.name}</span>
                      <span className="flex items-center gap-1 text-xs text-muted"><Globe className="h-3 w-3" /> public</span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </FadeIn>
  );
}
