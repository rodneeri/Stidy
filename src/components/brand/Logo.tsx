import { cn } from "@/lib/utils";

interface LogoProps {
  /** Pixel size of the square mark. */
  size?: number;
  /** Show the "STiDY" wordmark next to the mark. */
  wordmark?: boolean;
  className?: string;
}

/**
 * STiDY brand mark: a neumorphic squircle holding an "ascending bars" glyph
 * (academic progress / rising grades), paired with the "STiDY" wordmark whose
 * lowercase "i" is tinted in the accent colour as a signature.
 */
export function Logo({ size = 40, wordmark = true, className }: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <span
        aria-hidden
        className="grid shrink-0 place-items-center rounded-[28%] bg-gradient-to-br from-primary to-secondary shadow-[var(--shadow-glow)]"
        style={{ width: size, height: size }}
      >
        <svg
          viewBox="0 0 24 24"
          width={size * 0.62}
          height={size * 0.62}
          fill="none"
          className="text-primary-foreground"
        >
          {/* three rounded bars rising left→right */}
          <rect x="3.5" y="13" width="3.6" height="7" rx="1.8" fill="currentColor" opacity="0.7" />
          <rect x="10.2" y="9" width="3.6" height="11" rx="1.8" fill="currentColor" opacity="0.85" />
          <rect x="16.9" y="4" width="3.6" height="16" rx="1.8" fill="currentColor" />
        </svg>
      </span>
      {wordmark && (
        <span
          className="font-display font-bold leading-none tracking-tight"
          style={{ fontSize: size * 0.62 }}
        >
          ST<span className="text-primary">i</span>DY
        </span>
      )}
    </span>
  );
}
