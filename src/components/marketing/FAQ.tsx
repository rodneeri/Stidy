"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";
import { dur, easeOut } from "@/lib/motion";
import { cn } from "@/lib/utils";

export interface FAQItem {
  question: string;
  answer: string;
}

interface FAQProps {
  items: FAQItem[];
  className?: string;
}

/** Single accessible accordion entry — carved trigger, content grows/shrinks via height auto-animation. */
function FAQRow({ item, open, onToggle }: { item: FAQItem; open: boolean; onToggle: () => void }) {
  return (
    <div className="glass overflow-hidden rounded-2xl">
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left sm:px-6 sm:py-5"
      >
        <span className="font-semibold tracking-tight">{item.question}</span>
        <motion.span
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ duration: dur.fast, ease: easeOut }}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/15 text-primary"
        >
          <Plus className="h-4 w-4" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: dur.base, ease: easeOut }}
            className="overflow-hidden"
          >
            <p className="px-5 pb-5 text-sm text-muted sm:px-6 sm:pb-6">{item.answer}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** FAQ / Q&A accordion. Only one row open at a time; click again (or another row) to switch. */
export function FAQ({ items, className }: FAQProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className={cn("mx-auto flex max-w-2xl flex-col gap-3", className)}>
      {items.map((item, i) => (
        <FAQRow
          key={item.question}
          item={item}
          open={openIndex === i}
          onToggle={() => setOpenIndex((cur) => (cur === i ? null : i))}
        />
      ))}
    </div>
  );
}
