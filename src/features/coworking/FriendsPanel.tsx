"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { UserPlus, Check, X, UserMinus, Clock, Users2, AtSign } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { StatusDot } from "@/features/coworking/StatusDot";
import {
  listFriends,
  sendFriendRequest,
  respondFriendRequest,
  removeFriend,
  getProfiles,
  type Friend,
} from "@/features/coworking/social";

/** Friends graph for the coworking lobby: add by handle, accept/decline requests,
 *  see who's online, remove. Live-refreshes off the friendships realtime stream. */
export function FriendsPanel({ userId }: { userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [myHandle, setMyHandle] = useState<string | null>(null);
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setFriends(await listFriends());
    } catch {
      /* non-fatal: leave the list as-is */
    }
  }, []);

  useEffect(() => {
    refresh();
    getProfiles([userId])
      .then((p) => setMyHandle(p[0]?.handle ?? null))
      .catch(() => {});
  }, [refresh, userId]);

  // Live: a request sent/accepted/removed anywhere refreshes this panel.
  useEffect(() => {
    const channel = supabase
      .channel("social:friendships")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friendships" },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, refresh]);

  const add = async () => {
    const h = handle.trim().replace(/^@/, "");
    if (!h || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const outcome = await sendFriendRequest(h);
      setHandle("");
      setNotice(
        outcome === "accepted"
          ? "You're now friends — they had already invited you."
          : outcome === "already_friends"
            ? "You're already friends."
            : outcome === "pending"
              ? "Request already pending."
              : `Request sent to @${h}.`,
      );
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send the request.");
    } finally {
      setBusy(false);
    }
  };

  const respond = async (id: string, accept: boolean) => {
    await respondFriendRequest(id, accept).catch(() => {});
    refresh();
  };

  const drop = async (otherId: string) => {
    await removeFriend(otherId).catch(() => {});
    refresh();
  };

  const incoming = friends.filter((f) => f.direction === "incoming");
  const outgoing = friends.filter((f) => f.direction === "outgoing");
  const accepted = friends.filter((f) => f.direction === "friend");

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-semibold tracking-tight text-muted">Friends</h2>
        {myHandle && (
          <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
            <AtSign className="h-3 w-3" />
            {myHandle}
          </span>
        )}
      </div>

      <div className="glass space-y-4 p-5">
        {/* Add by handle */}
        <div>
          <div className="flex gap-2">
            <div className="field flex flex-1 items-center gap-2 rounded-lg px-3">
              <AtSign className="h-4 w-4 shrink-0 text-muted" />
              <input
                value={handle}
                onChange={(e) => setHandle(e.target.value.replace(/\s/g, ""))}
                placeholder="add a friend by handle"
                className="w-full bg-transparent py-2 text-sm outline-none placeholder:text-muted"
                onKeyDown={(e) => e.key === "Enter" && add()}
              />
            </div>
            <button
              onClick={add}
              disabled={!handle.trim() || busy}
              className="neu-btn flex items-center gap-2 rounded-lg px-4 text-sm font-medium text-primary disabled:opacity-40"
            >
              <UserPlus className="h-4 w-4" /> Add
            </button>
          </div>
          {error && <p className="mt-2 text-xs text-warning">{error}</p>}
          {notice && <p className="mt-2 text-xs text-primary">{notice}</p>}
        </div>

        {/* Incoming requests */}
        {incoming.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Requests</p>
            {incoming.map((f) => (
              <FriendRow key={f.friendship_id} f={f}>
                <button
                  onClick={() => respond(f.friendship_id, true)}
                  className="neu-btn grid h-8 w-8 place-items-center rounded-full text-primary"
                  title="Accept"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  onClick={() => respond(f.friendship_id, false)}
                  className="neu-btn grid h-8 w-8 place-items-center rounded-full text-muted hover:text-warning"
                  title="Decline"
                >
                  <X className="h-4 w-4" />
                </button>
              </FriendRow>
            ))}
          </div>
        )}

        {/* Accepted friends */}
        <div className="space-y-2">
          {accepted.length === 0 && incoming.length === 0 && outgoing.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <Users2 className="h-6 w-6 text-muted" />
              <p className="text-sm text-muted">
                No friends yet — share your handle or add someone above.
              </p>
            </div>
          ) : (
            accepted.map((f) => (
              <FriendRow key={f.friendship_id} f={f}>
                <button
                  onClick={() => drop(f.user_id)}
                  className="neu-btn grid h-8 w-8 place-items-center rounded-full text-muted hover:text-warning"
                  title="Remove friend"
                >
                  <UserMinus className="h-4 w-4" />
                </button>
              </FriendRow>
            ))
          )}
        </div>

        {/* Outgoing */}
        {outgoing.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Pending</p>
            {outgoing.map((f) => (
              <FriendRow key={f.friendship_id} f={f} pending>
                <button
                  onClick={() => drop(f.user_id)}
                  className="neu-btn grid h-8 w-8 place-items-center rounded-full text-muted hover:text-warning"
                  title="Cancel request"
                >
                  <X className="h-4 w-4" />
                </button>
              </FriendRow>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function FriendRow({
  f,
  pending,
  children,
}: {
  f: Friend;
  pending?: boolean;
  children: React.ReactNode;
}) {
  const initial = (f.name || "?").charAt(0).toUpperCase();
  return (
    <div className="flex items-center gap-3">
      <div className="relative shrink-0">
        {f.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={f.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
        ) : (
          <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-primary to-secondary text-xs font-semibold text-primary-foreground">
            {initial}
          </span>
        )}
        {!pending && (
          <StatusDot status={f.status} ring className="absolute -bottom-0.5 -right-0.5 h-3 w-3" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{f.name}</p>
        <p className="flex items-center gap-1 truncate text-xs text-muted">
          {pending ? (
            <>
              <Clock className="h-3 w-3" /> invited
            </>
          ) : f.handle ? (
            <>@{f.handle}</>
          ) : null}
        </p>
      </div>
      <div className={cn("flex items-center gap-1.5")}>{children}</div>
    </div>
  );
}
