import { STATUS_META, type PresenceStatus } from "@/features/coworking/social";
import { cn } from "@/lib/utils";

/** A colored presence dot. `ring` adds a surface-colored halo so it reads when
 *  overlaid on an avatar. Colors come from STATUS_META (studying uses --primary). */
export function StatusDot({
  status,
  className,
  ring = false,
}: {
  status: PresenceStatus;
  className?: string;
  ring?: boolean;
}) {
  return (
    <span
      title={STATUS_META[status].label}
      className={cn("inline-block rounded-full", ring && "ring-2 ring-[hsl(var(--surface))]", className)}
      style={{ background: STATUS_META[status].dot }}
    />
  );
}
