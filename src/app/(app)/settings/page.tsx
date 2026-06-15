import { HelpCircle } from "lucide-react";
import { GlassCard } from "@/components/shared/GlassCard";
import { FadeIn } from "@/components/motion/FadeIn";
import { ThemeSwitcher } from "@/components/theme/ThemeSwitcher";
import { GradeScaleSetting } from "@/components/settings/GradeScaleSetting";
import { ManualsGrid } from "@/components/settings/ManualsGrid";

const GUIDE = ["dashboard", "grades", "subjects", "resources", "timetable", "flashcards", "focus", "settings"];

export default function SettingsPage() {
  return (
    <FadeIn className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-muted">Tune STiDY to match how you work.</p>
      </header>

      <GlassCard className="space-y-4">
        <div>
          <h2 className="font-semibold">Appearance</h2>
          <p className="text-sm text-muted">
            Pick a theme preset. Your choice is saved to this device.
          </p>
        </div>
        <ThemeSwitcher />
      </GlassCard>

      <GlassCard className="space-y-4">
        <div>
          <h2 className="font-semibold">Grading scale</h2>
          <p className="text-sm text-muted">
            How grades are shown across the app — percent, out of 10, letters, or GPA.
          </p>
        </div>
        <GradeScaleSetting />
      </GlassCard>

      <GlassCard className="space-y-4">
        <div>
          <h2 className="font-semibold">Manuals</h2>
          <p className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
            Click any tool to open its full manual. Tip: the
            <span className="inline-flex items-center gap-1 font-medium text-foreground">
              <HelpCircle className="h-3.5 w-3.5" /> button
            </span>
            (bottom-right) explains whatever page you&apos;re on.
          </p>
        </div>
        <ManualsGrid keys={GUIDE} />
      </GlassCard>
    </FadeIn>
  );
}
