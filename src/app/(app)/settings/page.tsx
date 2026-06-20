import { LogOut, ShieldCheck } from "lucide-react";
import { GlassCard } from "@/components/shared/GlassCard";
import { FadeIn } from "@/components/motion/FadeIn";
import { GradeScaleSetting } from "@/components/settings/GradeScaleSetting";
import { AppearanceSetting } from "@/components/settings/AppearanceSetting";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/config/admin";
import { signOut } from "@/app/(auth)/actions";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email ?? "";
  const displayName = (user?.user_metadata?.full_name as string | undefined) ?? email ?? "Student";
  const initial = (displayName || email || "S").charAt(0).toUpperCase();
  const admin = isAdminEmail(email);

  return (
    <FadeIn className="space-y-6">
      <header>
        <h1 className="display-3">Settings</h1>
        <p className="mt-1 text-muted">Tune STiDY to match how you work.</p>
      </header>

      {/* Account */}
      <GlassCard className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-secondary text-base font-semibold text-primary-foreground shadow-[var(--shadow-glow)]">
            {initial}
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 truncate font-semibold">
              {displayName}
              {admin && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                  <ShieldCheck className="h-3 w-3" /> Admin
                </span>
              )}
            </p>
            <p className="truncate text-sm text-muted">{email}</p>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="pressable flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted hover:text-danger"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </form>
        </div>
      </GlassCard>

      {/* Appearance — collapsible */}
      <GlassCard>
        <AppearanceSetting />
      </GlassCard>

      {/* Grading scale */}
      <GlassCard className="space-y-4">
        <div>
          <h2 className="font-semibold">Grading scale</h2>
          <p className="text-sm text-muted">
            How grades are shown across the app — percent, out of 10, letters, or GPA.
          </p>
        </div>
        <GradeScaleSetting />
      </GlassCard>
    </FadeIn>
  );
}
