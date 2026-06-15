"use client";

import { BookOpen } from "lucide-react";
import { useSubjectIcons } from "@/lib/subject-icons";
import { cn } from "@/lib/utils";

const SIZES = {
  xs: "h-5 w-5 text-xs",
  sm: "h-6 w-6 text-sm",
  md: "h-8 w-8 text-base",
  lg: "h-10 w-10 text-xl",
} as const;

interface SubjectIconProps {
  id: string;
  color?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}

/**
 * Colored tile showing a subject's chosen emoji (from the local icon store),
 * falling back to a book glyph. Single source of truth so the subject's identity
 * reads the same everywhere it's referenced.
 */
export function SubjectIcon({ id, color, size = "md", className }: SubjectIconProps) {
  const icons = useSubjectIcons();
  const emoji = icons[id];
  return (
    <span
      className={cn("grid shrink-0 place-items-center rounded-lg text-white", SIZES[size], className)}
      style={{ background: color ?? "#14b8a6" }}
      aria-hidden
    >
      {emoji ? <span className="leading-none">{emoji}</span> : <BookOpen className="h-[55%] w-[55%]" />}
    </span>
  );
}
