"use client";

import { Search, Bell, LogOut } from "lucide-react";
import { ThemePicker } from "@/components/theme/ThemePicker";
import { signOut } from "@/app/(auth)/actions";

interface TopbarProps {
  displayName: string;
  email: string;
}

export function Topbar({ displayName, email }: TopbarProps) {
  const initial = (displayName || email || "S").charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 px-5 backdrop-blur-md">
      <label className="neu-inset flex h-10 max-w-md flex-1 items-center gap-2.5 rounded-full px-4">
        <Search className="h-4 w-4 text-muted" />
        <input
          placeholder="Search subjects, resources, tasks…"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
        />
      </label>

      <div className="ml-auto flex items-center gap-2.5">
        <ThemePicker />
        <button
          type="button"
          aria-label="Notifications"
          className="neu-btn grid h-9 w-9 place-items-center rounded-full"
        >
          <Bell className="h-4 w-4" />
        </button>

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
