import { cn } from "@/lib/utils";

/** Themed surface card. Renders the `.glass` look (or neumorphic under Soft UI). */
export function GlassCard({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("glass hairline p-5", className)} {...props}>
      {children}
    </div>
  );
}
