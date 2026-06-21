"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, Sparkles, Timer, Users, MessageCircle, ArrowRight, ArrowLeft } from "lucide-react";
import { Mascot } from "@/components/ui/Mascot";

const FLAG = "stidy-onboarded";

type Step = { icon: React.ElementType; title: string; body: string };
const STEPS: Step[] = [
  {
    icon: BookOpen,
    title: "Hi, I'm Sidy 👋",
    body: "Your STiDY study buddy. Let me show you around in a few taps — it takes 20 seconds.",
  },
  {
    icon: BookOpen,
    title: "Add your subjects & materials",
    body: "Create subjects, then upload notes, slides and past papers in Resources. Everything else builds on them.",
  },
  {
    icon: Sparkles,
    title: "Study Lab does the heavy lifting",
    body: "Generate flashcards and exams, or paste a problem and let the Solver work it out step by step — all grounded in YOUR uploaded files.",
  },
  {
    icon: Timer,
    title: "Focus, your way",
    body: "Run a focus timer that keeps ticking in a floating mini-clock while you move around the app. Your time feeds your dashboard charts.",
  },
  {
    icon: Users,
    title: "Study together",
    body: "Spin up a Coworking room: a shared timer, live chat, and friends studying alongside you.",
  },
  {
    icon: MessageCircle,
    title: "Ask me anything, anytime",
    body: "Tap the chat button for an assistant that knows your grades, deadlines and materials. You're all set — let's go!",
  },
];

/** First-run, skippable walkthrough. Shows once (localStorage), then never again. */
export function Onboarding() {
  const [open, setOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(FLAG) !== "1";
    } catch {
      return false;
    }
  });
  const [i, setI] = useState(0);

  function close() {
    try {
      localStorage.setItem(FLAG, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  const step = STEPS[i];
  const last = i === STEPS.length - 1;
  const Icon = step?.icon ?? Sparkles;

  return (
    <AnimatePresence>
      {open && step && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] grid place-items-center bg-background/70 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.94, y: 14, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="glass relative w-full max-w-md overflow-hidden rounded-3xl p-6 text-center sm:p-8"
          >
            <div className="mx-auto mb-2 grid place-items-center">
              <Mascot size={104} />
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.22 }}
              >
                <div className="mx-auto mb-3 grid h-9 w-9 place-items-center rounded-xl bg-primary/15 text-primary">
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <h2 className="text-lg font-semibold">{step.title}</h2>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">{step.body}</p>
              </motion.div>
            </AnimatePresence>

            {/* progress dots */}
            <div className="my-5 flex items-center justify-center gap-1.5">
              {STEPS.map((_, idx) => (
                <span
                  key={idx}
                  className={`h-1.5 rounded-full transition-all ${idx === i ? "w-5 bg-primary" : "w-1.5 bg-foreground/15"}`}
                />
              ))}
            </div>

            <div className="flex items-center justify-between gap-3">
              {i > 0 ? (
                <button
                  onClick={() => setI((v) => v - 1)}
                  className="pressable inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-muted hover:text-foreground"
                >
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
              ) : (
                <button onClick={close} className="pressable rounded-xl px-3 py-2 text-sm text-muted hover:text-foreground">
                  Skip
                </button>
              )}
              <button
                onClick={() => (last ? close() : setI((v) => v + 1))}
                className="neu-btn inline-flex items-center gap-1.5 rounded-xl px-5 py-2 text-sm font-medium text-primary"
              >
                {last ? "Get started" : "Next"}
                {!last && <ArrowRight className="h-4 w-4" />}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
