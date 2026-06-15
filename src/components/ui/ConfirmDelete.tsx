"use client";

import { useState } from "react";
import { Trash2, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConfirmDeleteProps {
  onConfirm: () => void;
  label?: string;
  className?: string;
}

/**
 * Two-click destructive button (trash → confirm). Reusable across tabs.
 * Stops propagation so it works inside clickable rows.
 */
export function ConfirmDelete({ onConfirm, label = "Delete", className }: ConfirmDeleteProps) {
  const [armed, setArmed] = useState(false);

  const stop = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  if (armed) {
    return (
      <span className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          aria-label={`Confirm ${label}`}
          onClick={(e) => {
            stop(e);
            onConfirm();
            setArmed(false);
          }}
          className="grid h-7 w-7 place-items-center rounded-lg bg-danger/15 text-danger"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          aria-label="Cancel"
          onClick={(e) => {
            stop(e);
            setArmed(false);
          }}
          className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      aria-label={label}
      onClick={(e) => {
        stop(e);
        setArmed(true);
      }}
      className={cn(
        "pressable grid h-7 w-7 place-items-center rounded-lg text-muted hover:text-danger",
        className,
      )}
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}
