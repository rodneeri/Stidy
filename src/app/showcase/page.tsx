"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Flame,
  Timer,
  BookOpen,
  Check,
  Brain,
  Sparkles,
  Bookmark,
  NotebookPen,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  GraduationCap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { staggerParent, staggerChild, reveal } from "@/lib/motion";
import { Dial, CountUp } from "@/components/ui/Dial";

/**
 * STiDY — Soft UI showcase / living style reference.
 * Study-focused tiles that demonstrate the elevated neumorphic language:
 * display type, grain, .neu-lg depth, scroll reveals, springy micro-motion,
 * animated radial dials (no bar charts), and a flip flashcard. Self-contained
 * under `data-theme="soft"` so every token resolves to the Soft UI palette.
 */
export default function SoftUIShowcase() {
  const [studying, setStudying] = useState(true);
  const [flipped, setFlipped] = useState(false);

  return (
    <div
      data-theme="soft"
      className="relative min-h-screen bg-background px-6 py-16 text-foreground"
    >
      <div className="mx-auto max-w-5xl">
        {/* ---- Hero ---------------------------------------------------- */}
        <motion.header variants={reveal} initial="hidden" animate="show" className="mb-14">
          <p className="eyebrow mb-3 flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            STiDY · Design Language
          </p>
          <h1 className="display-1">
            Study, <span className="text-gradient">sculpted</span>.
          </h1>
          <p className="mt-5 max-w-[46ch] text-lg text-muted">
            One soft surface, shaped with light and shadow. Every control is
            physical — it lifts, presses, and springs back. Built for focus.
          </p>
        </motion.header>

        {/* ---- Tile grid ---------------------------------------------- */}
        <motion.div
          variants={staggerParent}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-8% 0px" }}
          className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          {/* Brand mark — gentle float */}
          <Tile>
            <motion.span
              animate={{ y: [0, -7, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              className="text-gradient text-5xl font-black tracking-tight"
              style={{ fontFamily: "var(--font-display)" }}
            >
              STiDY
            </motion.span>
          </Tile>

          {/* Focus-mode switch — glow lives in the track, circle stays normal */}
          <Tile>
            <button
              type="button"
              role="switch"
              aria-checked={studying}
              aria-label="Study mode"
              onClick={() => setStudying((v) => !v)}
              className={cn(
                "neu-inset relative h-9 w-16 rounded-full transition-all duration-300",
                studying && "bg-[hsl(var(--primary)/0.22)]",
              )}
              style={
                studying
                  ? { boxShadow: "var(--neu-inset), inset 0 0 14px hsl(var(--primary) / 0.65)" }
                  : undefined
              }
            >
              <span
                className={cn(
                  "neu absolute top-1 h-7 w-7 rounded-full transition-all duration-300",
                  studying ? "left-8" : "left-1",
                )}
              />
            </button>
            <span className="mt-5 text-sm text-muted">
              {studying ? "Focus mode on" : "Focus mode off"}
            </span>
          </Tile>

          {/* Focus session transport */}
          <Tile>
            <div className="flex items-center gap-4">
              <button className="neu-btn grid h-11 w-11 place-items-center" aria-label="Previous">
                <SkipBack className="h-4 w-4" />
              </button>
              <button
                onClick={() => setStudying((v) => !v)}
                className="neu-btn grid h-14 w-14 place-items-center text-primary"
                aria-label={studying ? "Pause session" : "Start session"}
              >
                {studying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              </button>
              <button className="neu-btn grid h-11 w-11 place-items-center" aria-label="Next">
                <SkipForward className="h-4 w-4" />
              </button>
            </div>
            <span className="mt-5 font-mono text-sm text-muted" data-numeric>
              Focus · 24:13
            </span>
          </Tile>

          {/* Grade dial — animated radial, counts on */}
          <Tile>
            <Dial
              value={87}
              center={
                <span
                  className="text-3xl font-semibold"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  8.7
                </span>
              }
            />
            <span className="mt-3 text-sm text-muted">Term grade</span>
          </Tile>

          {/* Clean action pills (no cursor-follow) */}
          <Tile>
            <div className="flex flex-col items-center gap-3">
              <button className="neu-btn flex w-44 items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-primary">
                <Brain className="h-4 w-4" /> Review now
              </button>
              <button className="neu-btn flex w-44 items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-medium">
                <BookOpen className="h-4 w-4" /> Open subjects
              </button>
            </div>
          </Tile>

          {/* Study streak — glowing flame + gradient count-up (no white box) */}
          <Tile>
            <div className="relative grid h-14 w-14 place-items-center">
              <motion.span
                aria-hidden
                animate={{ scale: [1, 1.18, 1], opacity: [0.45, 0.8, 0.45] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-0 rounded-full"
                style={{
                  background: "radial-gradient(circle, hsl(var(--primary) / 0.5), transparent 70%)",
                  filter: "blur(7px)",
                }}
              />
              <Flame
                className="relative h-7 w-7 text-primary"
                style={{ filter: "drop-shadow(0 0 6px hsl(var(--primary) / 0.6))" }}
              />
            </div>
            <p className="mt-3 flex items-baseline gap-1.5">
              <span
                className="text-gradient text-4xl font-bold"
                data-numeric
                style={{ fontFamily: "var(--font-display)" }}
              >
                <CountUp to={17} />
              </span>
              <span className="text-sm text-muted">days</span>
            </p>
            <span className="eyebrow mt-1">Study streak</span>
          </Tile>

          {/* Flip flashcard — click to reveal */}
          <FlipFlashcard flipped={flipped} onFlip={() => setFlipped((v) => !v)} />

          {/* Quick study actions */}
          <Tile>
            <div className="flex gap-3">
              {[Bookmark, NotebookPen, Check].map((Icon, i) => (
                <button
                  key={i}
                  className="neu-btn grid h-11 w-11 place-items-center"
                  aria-label="action"
                >
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
            <span className="mt-5 text-sm text-muted">Save · Note · Done</span>
          </Tile>
        </motion.div>

        {/* ---- Subject mastery radials -------------------------------- */}
        <motion.div
          variants={reveal}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-8% 0px" }}
          className="neu-lg hairline mt-6 px-8 py-8"
        >
          <p className="eyebrow mb-6">Subject mastery</p>
          <div className="flex flex-wrap justify-around gap-8">
            {[
              { name: "Calculus", value: 78, icon: GraduationCap },
              { name: "Organic Chem", value: 64, icon: BookOpen },
              { name: "Linear Algebra", value: 91, icon: Brain },
              { name: "Statistics", value: 52, icon: Timer },
            ].map((s) => (
              <div key={s.name} className="flex flex-col items-center gap-3">
                <Dial value={s.value} size={104} />
                <span className="text-sm text-muted">{s.name}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/* Building blocks                                                          */
/* ----------------------------------------------------------------------- */

/** A raised tile that cascades in and lifts on hover. */
function Tile({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      variants={staggerChild}
      className={cn(
        "neu lift hairline flex min-h-40 flex-col items-center justify-center p-6 text-center",
        className,
      )}
    >
      {children}
    </motion.div>
  );
}

/** 3D flip flashcard — front question, back answer. */
function FlipFlashcard({ flipped, onFlip }: { flipped: boolean; onFlip: () => void }) {
  return (
    <motion.button
      variants={staggerChild}
      onClick={onFlip}
      className="lift relative min-h-40 sm:col-span-2"
      style={{ perspective: 1200 }}
      aria-label="Flip flashcard"
    >
      <motion.div
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 26 }}
        className="relative h-full min-h-40 w-full"
        style={{ transformStyle: "preserve-3d" }}
      >
        {/* Front */}
        <div
          className="neu hairline absolute inset-0 flex flex-col items-start justify-center gap-2 p-7 text-left"
          style={{ backfaceVisibility: "hidden" }}
        >
          <span className="eyebrow">Flashcard · tap to flip</span>
          <p className="display-3">Derivative of sin(x)?</p>
          <span className="mt-1 flex items-center gap-1.5 text-sm text-muted">
            <RotateCcw className="h-3.5 w-3.5" /> Spaced repetition · due today
          </span>
        </div>
        {/* Back */}
        <div
          className="neu-lg hairline absolute inset-0 flex flex-col items-start justify-center gap-2 p-7 text-left"
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
          <span className="eyebrow text-primary">Answer</span>
          <p className="display-3 text-gradient">cos(x)</p>
          <span className="mt-1 flex items-center gap-1.5 text-sm text-muted">
            <Check className="h-3.5 w-3.5 text-primary" /> Mark as known
          </span>
        </div>
      </motion.div>
    </motion.button>
  );
}
