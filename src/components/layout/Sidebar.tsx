"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { NAV_ITEMS } from "@/config/nav";
import { Logo } from "@/components/brand/Logo";
import { cn } from "@/lib/utils";
import { spring } from "@/lib/motion";
import { useUiStore } from "@/stores/ui-store";

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1.5">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
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
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const mobileNavOpen = useUiStore((s) => s.mobileNavOpen);
  const setMobileNav = useUiStore((s) => s.setMobileNav);

  // Close the drawer whenever the route changes.
  useEffect(() => {
    setMobileNav(false);
  }, [pathname, setMobileNav]);

  // Close on Escape.
  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMobileNav(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileNavOpen, setMobileNav]);

  return (
    <>
      {/* Desktop rail */}
      <aside className="neu hairline sticky top-3 m-3 hidden h-[calc(100vh-1.5rem)] w-60 shrink-0 flex-col gap-2 rounded-3xl px-4 py-6 lg:flex">
        <Link href="/dashboard" className="mb-7 flex items-center px-1">
          <Logo size={44} />
        </Link>
        <NavList />
        <div className="mt-auto px-2 text-xs text-muted">STiDY · v0.1</div>
      </aside>

      {/* Mobile slide-over drawer */}
      <AnimatePresence>
        {mobileNavOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-background/70 backdrop-blur-sm"
              onClick={() => setMobileNav(false)}
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="neu hairline absolute left-0 top-0 flex h-full w-[78%] max-w-72 flex-col gap-2 rounded-r-3xl px-4 py-6"
              role="dialog"
              aria-modal="true"
              aria-label="Navigation"
            >
              <div className="mb-7 flex items-center justify-between px-1">
                <Logo size={40} />
                <button
                  onClick={() => setMobileNav(false)}
                  aria-label="Close navigation"
                  className="pressable grid h-9 w-9 place-items-center rounded-lg text-muted hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <NavList onNavigate={() => setMobileNav(false)} />
              <div className="mt-auto px-2 text-xs text-muted">STiDY · v0.1</div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
