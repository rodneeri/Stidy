import type { LucideIcon } from "lucide-react";
import { GlassCard } from "@/components/shared/GlassCard";
import { FadeIn } from "@/components/motion/FadeIn";

interface PagePlaceholderProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

/** Elegant "module coming online" state for routes not yet built out. */
export function PagePlaceholder({ icon: Icon, title, description }: PagePlaceholderProps) {
  return (
    <FadeIn>
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-muted">{description}</p>
      </header>

      <GlassCard className="flex min-h-[320px] flex-col items-center justify-center gap-4 text-center">
        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-primary/15 text-primary">
          <Icon className="h-7 w-7" />
        </div>
        <div>
          <p className="font-medium">This module is being assembled</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            The data layer and UI for {title.toLowerCase()} land in an upcoming build step.
          </p>
        </div>
      </GlassCard>
    </FadeIn>
  );
}
