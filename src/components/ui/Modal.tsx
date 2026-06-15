"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { spring } from "@/lib/motion";
import { Portal } from "@/components/ui/Portal";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

/**
 * Lightweight accessible modal: scrim + neumorphic panel, Esc / click-outside close.
 * Rendered through a {@link Portal} so it escapes any transformed ancestor
 * (e.g. the PageTransition's `will-change: transform`, which would otherwise make
 * `position: fixed` resolve against the centered content column, not the viewport).
 */
export function Modal({ open, onClose, title, children }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <Portal>
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div
            className="absolute inset-0 bg-black/55 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={spring.pop}
            className="glass relative z-10 w-full max-w-md p-6"
          >
            {title && <h2 className="mb-4 text-lg font-semibold tracking-tight">{title}</h2>}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="pressable absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-lg text-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    </Portal>
  );
}
