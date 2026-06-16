"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import {
  Search,
  LogOut,
  Sparkles,
  CornerDownLeft,
  Settings as SettingsIcon,
  ShieldCheck,
} from "lucide-react";
import { ThemePicker } from "@/components/theme/ThemePicker";
import { NotificationsBell } from "@/components/layout/NotificationsBell";
import { askAssistant } from "@/features/assistant/assistant-bus";
import { NAV_ITEMS } from "@/config/nav";
import { signOut } from "@/app/(auth)/actions";
import { isAdminEmail } from "@/config/admin";
import { spring } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface TopbarProps {
  displayName: string;
  email: string;
}

type Suggestion =
  | { kind: "nav"; label: string; href: string; icon: (typeof NAV_ITEMS)[number]["icon"] }
  | { kind: "ask"; label: string };

export function Topbar({ displayName, email }: TopbarProps) {
  const initial = (displayName || email || "S").charAt(0).toUpperCase();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
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

  // Suggestions: pages that match the query (jump to them) + an Ask-STiDY action.
  const items = useMemo<Suggestion[]>(() => {
    const query = q.trim().toLowerCase();
    if (!query) return [];
    const nav: Suggestion[] = NAV_ITEMS.filter((n) => n.label.toLowerCase().includes(query)).map(
      (n) => ({ kind: "nav", label: n.label, href: n.href, icon: n.icon }),
    );
    return [...nav, { kind: "ask", label: q.trim() }];
  }, [q]);

  useEffect(() => setActive(0), [q]);

  const run = (item: Suggestion) => {
    setOpen(false);
    setQ("");
    if (item.kind === "nav") router.push(item.href);
    else askAssistant(item.label);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const item = items[active] ?? items[0];
    if (item) run(item);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!items.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % items.length);
      setOpen(true);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + items.length) % items.length);
      setOpen(true);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 px-5 backdrop-blur-md">
      <div className="relative max-w-md flex-1">
        <form
          onSubmit={onSubmit}
          className="neu lift flex h-10 items-center gap-2.5 rounded-full px-4 focus-within:shadow-[var(--neu-raise),0_0_0_2px_hsl(var(--primary)/0.35)]"
        >
          <Search className="h-4 w-4 shrink-0 text-muted" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onKeyDown={onKeyDown}
            placeholder="Search pages, or ask STiDY…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
            aria-label="Search or ask the STiDY assistant"
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

        <AnimatePresence>
          {open && items.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={spring.pop}
              className="glass absolute left-0 right-0 top-12 z-40 overflow-hidden p-1.5"
            >
              {items.map((item, i) => (
                <button
                  key={item.kind === "nav" ? item.href : "ask"}
                  type="button"
                  // mousedown fires before the input's blur, so the click still registers
                  onMouseDown={(e) => {
                    e.preventDefault();
                    run(item);
                  }}
                  onMouseEnter={() => setActive(i)}
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
                      <>
                        Go to <span className="text-foreground">{item.label}</span>
                      </>
                    ) : (
                      <>
                        Ask STiDY: <span className="text-foreground">“{item.label}”</span>
                      </>
                    )}
                  </span>
                  {i === active && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 opacity-70" />}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="ml-auto flex items-center gap-2.5">
        <ThemePicker />
        <NotificationsBell />
        <ProfileMenu displayName={displayName} email={email} initial={initial} />
      </div>
    </header>
  );
}

/** Click-to-open account menu: identity header, admin badge, quick links, sign-out. */
function ProfileMenu({
  displayName,
  email,
  initial,
}: {
  displayName: string;
  email: string;
  initial: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const admin = isAdminEmail(email);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={email}
        className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-primary to-secondary text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)]"
      >
        {initial}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            transition={spring.pop}
            className="neu absolute right-0 top-12 z-40 min-w-56 overflow-hidden p-1.5"
          >
            <div className="flex items-center gap-2 px-3 py-2">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-secondary text-xs font-semibold text-primary-foreground">
                {initial}
              </span>
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                  {displayName}
                  {admin && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                      <ShieldCheck className="h-3 w-3" /> Admin
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-muted">{email}</p>
              </div>
            </div>

            <div className="my-1 h-px bg-border" />

            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              role="menuitem"
              className="pressable flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground hover:text-primary"
            >
              <SettingsIcon className="h-4 w-4" /> Settings
            </Link>

            <div className="my-1 h-px bg-border" />

            <form action={signOut}>
              <button
                type="submit"
                role="menuitem"
                className="pressable flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground hover:text-primary"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
