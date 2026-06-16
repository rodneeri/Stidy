/**
 * Admin allowlist.
 *
 * Lightweight, DB-free role check: an account is an admin if its email is in
 * this list (case-insensitive). This avoids a schema migration while the public
 * launch is being prepared; a proper `profiles.role` column can supersede it
 * later without changing call sites — just reimplement {@link isAdmin}.
 *
 * Override/extend at deploy time with NEXT_PUBLIC_ADMIN_EMAILS (comma-separated).
 */
const BUILT_IN_ADMINS = ["erkgraff@gmail.com"];

function adminEmails(): string[] {
  const fromEnv = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  return [...BUILT_IN_ADMINS, ...fromEnv].map((e) => e.toLowerCase());
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails().includes(email.toLowerCase());
}
