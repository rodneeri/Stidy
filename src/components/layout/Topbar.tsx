"use client";

import { useEffect, useRef, useState } from "react";
import { Search, LogOut, Sparkles, Command } from "lucide-react";
import { ThemePicker } from "@/components/theme/ThemePicker";
import { NotificationsBell } from "@/components/layout/NotificationsBell";
import { openCommandPalette } from "@/components/layout/CommandPalette";
import { askAssistant } from "@/features/assistant/assistant-bus";
import { signOut } from "@/app/(auth)/actions";

interface TopbarProps {
  displayName: string;
  email: string;
}

export function Topbar({ displayName, email }: TopbarProps) {
  const initial = (displayName || email || "S").charAt(0).toUpperCase();
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // "/" focuses the search (unless you're already typing somewhere).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement as HTMLElement | null;
      const typing =
        el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if (typing) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const ask = () => {
    const query = q.trim();
    if (!query) return;
    askAssistant(query); // opens the STiDY assistant + sends this query
    setQ("");
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 px-5 backdrop-blur-md">
      {/* Raised pill — Enter (or the spark) routes the query to the assistant. */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask();
        }}
        className="neu lift flex h-10 max-w-md flex-1 items-center gap-2.5 rounded-full px-4 focus-within:shadow-[var(--neu-raise),0_0_0_2px_hsl(var(--primary)/0.35)]"
      >
        <Search className="h-4 w-4 shrink-0 text-muted" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ask STiDY, or search your semester…"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
          aria-label="Ask the STiDY assistant"
        />
        {!q && (
          <kbd className="hidden rounded-md px-1.5 py-0.5 text-[10px] text-muted ring-1 ring-border md:block">
            /
          </kbd>
        )}
        <button
          type="submit"
          aria-label="Ask STiDY"
          className="pressable grid h-7 w-7 shrink-0 place-items-center rounded-full text-primary disabled:opacity-40"
          disabled={!q.trim()}
        >
          <Sparkles className="h-4 w-4" />
        </button>
      </form>

      <div className="ml-auto flex items-center gap-2.5">
        <button
          type="button"
          aria-label="Open command palette"
          title="Command palette (⌘K)"
          onClick={() => openCommandPalette()}
          className="neu-btn hidden h-9 items-center gap-1.5 rounded-full px-3 text-xs text-muted sm:flex"
        >
          <Command className="h-3.5 w-3.5" />
          <span className="font-medium">K</span>
        </button>

        <ThemePicker />
        <NotificationsBell />

        <div className="group relative">
          <span
            className="grid h-10 w-10 cursor-default place-items-center rounded-full bg-gradient-to-br from-primary to-secondary text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)]"
            title={email}
          >
            {initial}
          </span>
          <form
            action={signOut}
            className="absolute right-0 top-12 hidden min-w-44 group-hover:block"
          >
            <div className="neu overflow-hidden p-1.5">
              <p className="truncate px-3 py-2 text-xs text-muted">{email}</p>
              <button
                type="submit"
                className="pressable flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground hover:text-primary"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </div>
          </form>
        </div>
      </div>
    </header>
  );
}
