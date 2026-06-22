"use client";

import type { PostgrestError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

/**
 * Social layer for coworking — presence status + a friends graph, all routed
 * through the SECURITY DEFINER RPCs added in 2026-06-22_cowork_social.sql.
 *
 * Every call is feature-detected: if the migration hasn't been applied on a
 * given environment (the live DB can drift from repo migrations), the wrappers
 * resolve to empty/no-op instead of throwing, so the UI degrades quietly rather
 * than crashing. Mirrors the isMissingTable() guard the rooms code already uses.
 */

export type PresenceStatus = "offline" | "online" | "studying" | "break" | "away";

export interface PublicProfile {
  id: string;
  name: string;
  handle: string | null;
  avatar_url: string | null;
  status: PresenceStatus;
}

export type FriendDirection = "friend" | "incoming" | "outgoing";

export interface Friend {
  friendship_id: string;
  user_id: string;
  name: string;
  handle: string | null;
  avatar_url: string | null;
  status: PresenceStatus;
  direction: FriendDirection;
}

/** Result of asking to add someone by handle. */
export type FriendRequestOutcome =
  | "sent"
  | "accepted"
  | "pending"
  | "already_friends";

/** True when an RPC failed only because the social migration isn't applied. */
export function isMissingFunction(error: PostgrestError | null): boolean {
  if (!error) return false;
  return (
    error.code === "42883" || // undefined_function
    error.code === "PGRST202" || // PostgREST: function not found in schema cache
    /could not find the function|function .* does not exist|schema cache/i.test(
      error.message ?? "",
    )
  );
}

/** Ordered for status menus; label + a token/hue for the presence dot. */
export const STATUS_META: Record<
  PresenceStatus,
  { label: string; dot: string; selectable: boolean }
> = {
  online: { label: "Online", dot: "#34d399", selectable: true },
  studying: { label: "Studying", dot: "hsl(var(--primary))", selectable: true },
  break: { label: "On a break", dot: "#fbbf24", selectable: true },
  away: { label: "Away", dot: "#94a3b8", selectable: true },
  offline: { label: "Offline", dot: "hsl(var(--muted))", selectable: true },
};

export const SELECTABLE_STATUSES: PresenceStatus[] = [
  "online",
  "studying",
  "break",
  "away",
  "offline",
];

/** Look up public profiles for a set of user ids (room rosters, friend cards). */
export async function getProfiles(ids: string[]): Promise<PublicProfile[]> {
  if (ids.length === 0) return [];
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_profiles", { p_ids: ids });
  if (error) {
    if (isMissingFunction(error)) return [];
    throw error;
  }
  return (data ?? []) as PublicProfile[];
}

/** Resolve a single profile from its public handle (for "add friend"). */
export async function findProfileByHandle(
  handle: string,
): Promise<PublicProfile | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("find_profile_by_handle", {
    p_handle: handle,
  });
  if (error) {
    if (isMissingFunction(error)) return null;
    throw error;
  }
  const rows = (data ?? []) as PublicProfile[];
  return rows[0] ?? null;
}

/** Set my own presence; stamps last_seen server-side. No-op if not migrated. */
export async function setMyStatus(status: PresenceStatus): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("set_my_status", { p_status: status });
  if (error && !isMissingFunction(error)) throw error;
}

/** Send / auto-accept a friend request by handle. Throws AppError-friendly msg. */
export async function sendFriendRequest(
  handle: string,
): Promise<FriendRequestOutcome> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("send_friend_request", {
    p_handle: handle,
  });
  if (error) throw error;
  return data as FriendRequestOutcome;
}

export async function respondFriendRequest(
  friendshipId: string,
  accept: boolean,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("respond_friend_request", {
    p_id: friendshipId,
    p_accept: accept,
  });
  if (error) throw error;
}

export async function removeFriend(otherUserId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("remove_friend", { p_other: otherUserId });
  if (error) throw error;
}

/** Accepted friends + incoming/outgoing requests in one call. [] if not migrated. */
export async function listFriends(): Promise<Friend[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("list_friends");
  if (error) {
    if (isMissingFunction(error)) return [];
    throw error;
  }
  return (data ?? []) as Friend[];
}
