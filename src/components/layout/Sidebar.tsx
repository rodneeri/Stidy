"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { NAV_ITEMS } from "@/config/nav";
import { Logo } from "@/components/brand/Logo";
import { cn } from "@/lib/utils";
import { spring } from "@/lib/motion";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="neu hairline sticky top-3 m-3 hidden h-[calc(100vh-1.5rem)] w-60 shrink-0 flex-col gap-2 rounded-3xl px-4 py-6 lg:flex">
      <Link href="/dashboard" className="mb-7 flex items-center px-1">
        <Logo size={44} />
      </Link>

      <nav className="flex flex-col gap-1.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "pressable group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium",
                active ? "text-primary" : "text-muted hover:text-foreground",
              )}
            >
              {active && (
                <motion.span
                  layoutId="nav-active"
                  className="neu absolute inset-0 rounded-xl"
                  transition={spring.slide}
                />
              )}
              <Icon
                className={cn(
                  "relative z-10 h-[18px] w-[18px] transition-transform group-hover:scale-110",
                  active && "text-primary",
                )}
              />
              <span className="relative z-10">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto px-2 text-xs text-muted">STiDY · v0.1</div>
    </aside>
  );
}
