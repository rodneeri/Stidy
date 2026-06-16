"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Search, Sparkles, CornerDownLeft } from "lucide-react";
import { NAV_ITEMS } from "@/config/nav";
import { askAssistant } from "@/features/assistant/assistant-bus";
import { Portal } from "@/components/ui/Portal";
import { spring } from "@/lib/motion";
import { cn } from "@/lib/utils";

const OPEN_EVENT = "stidy-open-command";

/** Open the ⌘K command palette from anywhere (e.g. a topbar button). */
export function openCommandPalette() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OPEN_EVENT));
}

type Item =
  | { kind: "nav"; label: string; href: string; icon: typeof NAV_ITEMS[number]["icon"] }
  | { kind: "ask"; label: string };

/**
 * Linear-style quick-switcher. ⌘K / Ctrl+K toggles it; type to filter pages,
 * arrows + Enter to jump, or send the query straight to the STiDY assistant.
 */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Global ⌘K / Ctrl+K toggle + programmatic open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);

  // Reset + focus when opened.
  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const items = useMemo<Item[]>(() => {
    const q = query.trim().toLowerCase();
    const nav: Item[] = NAV_ITEMS.filter((n) => !q || n.label.toLowerCase().includes(q)).map(
      (n) => ({ kind: "nav", label: n.label, href: n.href, icon: n.icon }),
    );
    return q ? [...nav, { kind: "ask", label: query.trim() }] : nav;
  }, [query]);

  useEffect(() => setActive(0), [query]);

  const close = () => setOpen(false);

  const run = (item: Item) => {
    close();
    if (item.kind === "nav") router.push(item.href);
    else askAssistant(item.label);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (items.length ? (i + 1) % items.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (items.length ? (i - 1 + items.length) % items.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = items[active];
      if (item) run(item);
    } else if (e.key === "Escape") {
      close();
    }
  };

  return (
    <Portal>
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[14vh]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={close} aria-hidden />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Command palette"
              initial={{ opacity: 0, scale: 0.97, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 12 }}
              transition={spring.pop}
              className="glass relative z-10 w-full max-w-xl overflow-hidden p-2"
            >
              <div className="flex items-center gap-3 px-3 py-2">
                <Search className="h-4 w-4 shrink-0 text-muted" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="Jump to a page, or ask STiDY…"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
                  aria-label="Command palette search"
                />
                <kbd className="hidden rounded-md px-1.5 py-0.5 text-[10px] text-muted ring-1 ring-border sm:block">
                  ESC
                </kbd>
              </div>

              <div className="mt-1 max-h-72 overflow-auto px-1 pb-1">
                {items.map((item, i) => (
                  <button
                    key={item.kind === "nav" ? item.href : "ask"}
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => run(item)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm",
                      i === active ? "neu text-primary" : "text-muted hover:text-foreground",
                    )}
                  >
                    {item.kind === "nav" ? (
                      <item.icon className="h-[18px] w-[18px] shrink-0" />
                    ) : (
                      <Sparkles className="h-[18px] w-[18px] shrink-0 text-primary" />
                    )}
                    <span className="min-w-0 flex-1 truncate">
                      {item.kind === "nav" ? (
                        item.label
                      ) : (
                        <>
                          Ask STiDY: <span className="text-foreground">“{item.label}”</span>
                        </>
                      )}
                    </span>
                    {i === active && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 opacity-70" />}
                  </button>
                ))}
                {items.length === 0 && (
                  <p className="px-3 py-6 text-center text-sm text-muted">No matches.</p>
                )}
              </div>

              <div className="flex items-center gap-3 border-t border-border px-3 py-2 text-[11px] text-muted">
                <span><kbd className="font-sans">↑↓</kbd> navigate</span>
                <span><kbd className="font-sans">↵</kbd> select</span>
                <span className="ml-auto"><kbd className="font-sans">⌘K</kbd> toggle</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Portal>
  );
}
