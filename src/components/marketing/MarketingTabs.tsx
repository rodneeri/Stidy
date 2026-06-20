"use client";

import { useId, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { spring, dur, easeOut } from "@/lib/motion";
import { cn } from "@/lib/utils";

export interface MarketingTab {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Short heading shown above the body inside the panel. */
  title: string;
  body: string;
  bullets?: string[];
}

interface MarketingTabsProps {
  tabs: MarketingTab[];
  className?: string;
}

/**
 * Themed tab switcher for marketing sections — a pill rail with a sliding
 * active indicator (layoutId-driven, springs into place) above a panel that
 * cross-fades its content. Keyboard-accessible (role="tablist"/"tab").
 */
export function MarketingTabs({ tabs, className }: MarketingTabsProps) {
  const [active, setActive] = useState(tabs[0]?.id);
  const groupId = useId();
  const current = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <div className={cn("w-full", className)}>
      <div
        role="tablist"
        aria-label="STiDY features"
        className="glass mx-auto flex max-w-fit flex-wrap items-center justify-center gap-1 rounded-full p-1.5"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === current?.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(tab.id)}
              className={cn(
                "relative flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                isActive ? "text-primary-foreground" : "text-muted hover:text-foreground",
              )}
            >
              {isActive && (
                <motion.span
                  layoutId={`${groupId}-pill`}
                  className="absolute inset-0 rounded-full bg-primary"
                  transition={spring.slide}
                />
              )}
              <tab.icon className="relative z-10 h-4 w-4" />
              <span className="relative z-10">{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="relative mt-8">
        <AnimatePresence mode="wait">
          {current && (
            <motion.div
              key={current.id}
              initial={{ opacity: 0, y: 14, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
              transition={{ duration: dur.slow, ease: easeOut }}
              className="glass neu-lg grid gap-6 p-6 sm:p-10 md:grid-cols-[1fr_1.2fr]"
            >
              <div className="flex flex-col gap-4">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/15 text-primary">
                  <current.icon className="h-6 w-6" />
                </span>
                <h3 className="display-3 font-display font-bold tracking-tight">{current.title}</h3>
                <p className="text-muted">{current.body}</p>
              </div>
              {current.bullets && (
                <ul className="flex flex-col gap-3 self-center">
                  {current.bullets.map((b, i) => (
                    <motion.li
                      key={b}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: dur.base, delay: 0.08 + i * 0.05, ease: easeOut }}
                      className="glass flex items-start gap-3 rounded-2xl p-4 text-sm"
                    >
                      <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      {b}
                    </motion.li>
                  ))}
                </ul>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
