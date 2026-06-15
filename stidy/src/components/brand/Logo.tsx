import { cn } from "@/lib/utils";

interface LogoProps {
  /** Pixel size of the square mark. */
  size?: number;
  /** Show the "STiDY" wordmark next to the mark. */
  wordmark?: boolean;
  className?: string;
}

/**
 * STiDY brand mark: a raised neumorphic squircle (theme-adaptive surface, not a
 * flat gradient) holding an embossed graduation-cap glyph in the accent colour.
 * The wordmark is set in the display grotesk with the lowercase "i" tinted and
 * softly glowing in the accent as a signature.
 */
export function Logo({ size = 40, wordmark = true, className }: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <span
        aria-hidden
        className="neu grid shrink-0 place-items-center"
        style={{ width: size, height: size, borderRadius: size * 0.3 }}
      >
        <svg
          viewBox="0 0 24 24"
          width={size * 0.6}
          height={size * 0.6}
          fill="none"
          className="text-primary"
          style={{
            filter:
              "drop-shadow(0 1px 0 hsl(var(--neu-light) / 0.65)) drop-shadow(0 0 5px hsl(var(--primary) / 0.45))",
          }}
        >
          {/* mortarboard */}
          <path d="M12 3.2 1.8 8 12 12.8 22.2 8 12 3.2Z" fill="currentColor" />
          {/* cap base */}
          <path
            d="M5.6 10.3v3.8c0 .9.6 1.6 1.7 2.1 1.3.6 3 .9 4.7.9s3.4-.3 4.7-.9c1.1-.5 1.7-1.2 1.7-2.1v-3.8"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            fill="none"
            opacity="0.5"
          />
          {/* tassel */}
          <path d="M22.2 8v4.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="22.2" cy="13.2" r="1.1" fill="currentColor" />
        </svg>
      </span>
      {wordmark && (
        <span
          className="font-display font-bold leading-none tracking-[-0.03em]"
          style={{ fontSize: size * 0.6 }}
        >
          ST
          <span className="text-primary" style={{ textShadow: "0 0 8px hsl(var(--primary) / 0.5)" }}>
            i
          </span>
          DY
        </span>
      )}
    </span>
  );
}
