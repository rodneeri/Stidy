import type { PostgrestError } from "@supabase/supabase-js";

/**
 * True when a query failed only because the coworking tables haven't been
 * migrated yet — lets the UI show a graceful "rolling out" state instead of
 * crashing in production before Erick runs 2026-06-16_coworking.sql.
 */
export function isMissingTable(error: PostgrestError | null): boolean {
  if (!error) return false;
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /relation .* does not exist|could not find the table|schema cache/i.test(error.message ?? "")
  );
}
