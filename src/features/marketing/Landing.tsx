"use client";

import Link from "next/link";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import {
  GraduationCap,
  FolderOpen,
  FlaskConical,
  Timer,
  Users,
  Sparkles,
  Palette,
  ArrowRight,
  Brain,
  Zap,
  ShieldCheck,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { MeshBackground } from "@/components/layout/MeshBackground";
import { reveal, dur, easeOut } from "@/lib/motion";
import { MarketingTabs, type MarketingTab } from "@/components/marketing/MarketingTabs";
import { FAQ, type FAQItem } from "@/components/marketing/FAQ";
import { RoadmapSection } from "@/components/marketing/RoadmapSection";
import { ParallaxLayer } from "@/components/marketing/ParallaxLayer";
import { ScrollProgressRail } from "@/components/marketing/ScrollProgressRail";

const grotesk = "font-[family-name:var(--font-grotesk)]";

const TABS: MarketingTab[] = [
  {
    id: "grades",
    label: "Grades",
    icon: GraduationCap,
    title: "Grade Intelligence Engine",
    body: "Weighted averages, What-If sliders, and a Target Solver that tells you exactly what you need on the final. Import a syllabus and AI builds the structure for you.",
    bullets: [
      "Live weighted-average recalculation as you enter marks",
      "Target Solver: \"what do I need on the final to land an 8?\"",
      "Import a syllabus PDF — AI builds your grading structure",
    ],
  },
  {
    id: "coworking",
    label: "Coworking",
    icon: Users,
    title: "Coworking Hub",
    body: "Live co-study rooms with presence, a shared focus timer, and chat. Study with classmates, in sync.",
    bullets: [
      "See who else is studying, in real time",
      "Shared focus timer the whole room follows",
      "Lightweight chat without leaving the room",
    ],
  },
  {
    id: "vault",
    label: "Resource Vault",
    icon: FolderOpen,
    title: "Resource Vault",
    body: "Drop your files — AI auto-classifies them by subject and type. In-app viewer included.",
    bullets: [
      "Drag-and-drop upload, auto-sorted by subject",
      "Built-in viewer — PDFs, slides, images, no downloads",
      "Search across everything you've ever uploaded",
    ],
  },
  {
    id: "lab",
    label: "Study Lab",
    icon: FlaskConical,
    title: "Study Lab",
    body: "AI flashcards and practice exams grounded in your own materials, with spaced-repetition review.",
    bullets: [
      "Flashcards generated straight from your notes",
      "Practice exams that mirror your real material",
      "Spaced-repetition scheduling, tuned automatically",
    ],
  },
  {
    id: "focus",
    label: "Focus",
    icon: Timer,
    title: "Deep-Work Focus",
    body: "Pomodoro + stopwatch, Web-Audio ambience, study logging, and a burnout nudge when you overdo it.",
    bullets: [
      "Pomodoro or freeform stopwatch — your call",
      "Ambient soundscapes that run in the background",
      "A gentle nudge when a session's gone on too long",
    ],
  },
  {
    id: "ai",
    label: "Ask STiDY",
    icon: Sparkles,
    title: "Ask STiDY",
    body: "An assistant that actually knows your semester — subjects, grades, deadlines, and resources.",
    bullets: [
      "Grounded in your real subjects, grades, and files",
      "Resilient multi-model chain — it doesn't go down",
      "Ask it anything: \"what's due this week?\"",
    ],
  },
];

const FAQS: FAQItem[] = [
  {
    question: "Is STiDY free?",
    answer:
      "Yes — you can create an account and use the core tools (grades, timetable, resource vault, focus timer) for free. Some AI-heavy features may have fair-use limits as we grow.",
  },
  {
    question: "Which university system is this built for?",
    answer:
      "STiDY isn't tied to one country's grading scheme. The Grade Intelligence Engine supports custom weighting and scales, so it adapts to how your specific program calculates grades.",
  },
  {
    question: "What happens to my files and grades?",
    answer:
      "They're yours. Row-level security and private storage mean only your account can read your data — we don't sell it, and there's no public profile by default.",
  },
  {
    question: "Can I study with classmates inside STiDY?",
    answer:
      "Yes — the Coworking Hub gives you live presence, a shared focus timer, and lightweight chat so you can co-study in the same room without leaving the app.",
  },
  {
    question: "How does \"Ask STiDY\" actually know my semester?",
    answer:
      "It's grounded in the subjects, grades, deadlines, and files you've already added — so answers are about your actual semester, not generic study advice.",
  },
  {
    question: "I found a bug or want a feature — what do I do?",
    answer:
      "Check the Under Development section below first — it might already be on the way. If not, reach out through the in-app help button; we read everything.",
  },
];

const WHY = [
  {
    icon: Brain,
    title: "AI that knows you",
    body: "Resilient Gemini + Groq + NVIDIA chain, grounded in your own subjects and files.",
  },
  {
    icon: Palette,
    title: "Nine living themes",
    body: "A neumorphic design system that re-skins instantly — from midnight teal to chalkboard.",
  },
  {
    icon: ShieldCheck,
    title: "Your data, yours",
    body: "Row-level security, private file storage, signed links. Only you see your work.",
  },
];

export function Landing() {
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const heroY = useTransform(scrollYProgress, [0, 0.2], [0, reduce ? 0 : -60]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.16], [1, reduce ? 1 : 0.4]);

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <ScrollProgressRail />
      <MeshBackground />

      {/* Nav — exactly one logo lockup (mark + custom-styled "STiDY" text). */}
      <header className="sticky top-0 z-30 px-5 py-3">
        <nav className="glass mx-auto flex max-w-5xl items-center gap-3 rounded-full px-4 py-2.5">
          <Logo size={34} wordmark={false} />
          <span className={`text-lg font-bold tracking-tight ${grotesk}`}>STiDY</span>
          <div className="ml-auto hidden items-center gap-1 sm:flex">
            <a href="#features" className="pressable rounded-full px-3 py-2 text-sm text-muted hover:text-foreground">
              Features
            </a>
            <a href="#roadmap" className="pressable rounded-full px-3 py-2 text-sm text-muted hover:text-foreground">
              Roadmap
            </a>
            <a href="#faq" className="pressable rounded-full px-3 py-2 text-sm text-muted hover:text-foreground">
              FAQ
            </a>
          </div>
          <div className="ml-auto flex items-center gap-2 sm:ml-3">
            <Link
              href="/login"
              className="pressable rounded-full px-4 py-2 text-sm font-medium text-muted hover:text-foreground"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="neu-btn rounded-full px-4 py-2 text-sm font-semibold text-primary"
            >
              Get started
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative mx-auto max-w-5xl px-5 pb-24 pt-16 text-center sm:pt-24">
        <motion.div style={{ y: heroY, opacity: heroOpacity }}>
          <motion.span
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="neu inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium text-muted"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            The Personal Academic Operating System
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className={`mx-auto mt-6 max-w-3xl text-5xl font-bold leading-[1.05] tracking-tight sm:text-7xl ${grotesk}`}
          >
            Master your degree,
            <br />
            not your{" "}
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              tabs.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="mx-auto mt-6 max-w-xl text-lg text-muted"
          >
            One beautiful command center for grades, syllabi, resources, flashcards, focus, and
            studying together — with an AI that knows your semester.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="mt-9 flex flex-wrap items-center justify-center gap-3"
          >
            <Link
              href="/signup"
              className="neu-btn group flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-primary"
            >
              Start free
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/login"
              className="pressable rounded-full px-6 py-3 text-sm font-medium text-muted hover:text-foreground"
            >
              I already have an account
            </Link>
          </motion.div>
          <p className="mt-4 text-xs text-muted">Free to start · No credit card required</p>
        </motion.div>

        {/* Floating hero visual, with a subtle scroll-linked parallax drift. */}
        <ParallaxLayer speed={28} className="mt-16">
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.35 }}
            className="relative mx-auto max-w-3xl"
          >
            <div className="glass neu-lg grid gap-4 p-5 sm:grid-cols-3">
              <div className="glass flex flex-col items-center gap-2 p-5">
                <div
                  className="grid h-24 w-24 place-items-center rounded-full"
                  style={{
                    background: `conic-gradient(hsl(var(--primary)) 78%, hsl(var(--surface)) 0)`,
                    WebkitMask: "radial-gradient(farthest-side,#0000 calc(100% - 11px),#000 0)",
                    mask: "radial-gradient(farthest-side,#0000 calc(100% - 11px),#000 0)",
                  }}
                />
                <p className="-mt-16 text-2xl font-bold tabular-nums">7.8</p>
                <p className="mt-10 text-xs text-muted">Weighted average</p>
              </div>
              <div className="glass flex flex-col justify-between p-5 text-left">
                <p className="text-xs text-muted">Next exam</p>
                <p className={`text-lg font-bold ${grotesk}`}>Cálculo II</p>
                <p className="text-sm text-primary">in 3 days</p>
              </div>
              <motion.div
                animate={reduce ? {} : { y: [0, -8, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="glass flex flex-col justify-between p-5 text-left"
              >
                <Users className="h-5 w-5 text-primary" />
                <p className="text-sm font-medium">3 studying now</p>
                <p className="text-xs text-muted">Coworking · Sala A</p>
              </motion.div>
            </div>
          </motion.div>
        </ParallaxLayer>
      </section>

      {/* Features — tabbed deep-dive */}
      <section id="features" className="mx-auto max-w-5xl px-5 py-16 sm:py-24">
        <motion.div
          variants={reveal}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-12% 0px" }}
          className="text-center"
        >
          <span className="eyebrow">Everything, in one place</span>
          <h2 className="display-2 mx-auto mt-3 max-w-2xl font-display font-bold tracking-tight">
            Everything your semester needs
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted">
            Stop juggling a planner, a grade spreadsheet, an LMS, and five flashcard apps. STiDY is
            one place — pick a tab to see it in action.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-10% 0px" }}
          transition={{ duration: dur.slow, ease: easeOut }}
          className="mt-12"
        >
          <MarketingTabs tabs={TABS} />
        </motion.div>
      </section>

      {/* Why strip */}
      <section className="mx-auto max-w-5xl px-5 py-16">
        <div className="grid gap-4 sm:grid-cols-3">
          {WHY.map((c, i) => (
            <motion.div
              key={c.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-10% 0px" }}
              transition={{ duration: dur.slow, delay: i * 0.08, ease: easeOut }}
              className="flex flex-col gap-2"
            >
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-secondary/15 text-secondary">
                <c.icon className="h-5 w-5" />
              </span>
              <h3 className="font-bold tracking-tight">{c.title}</h3>
              <p className="text-sm text-muted">{c.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Under development / roadmap — fully data-driven, see roadmap-data.ts */}
      <RoadmapSection />

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-5xl px-5 py-16 sm:py-24">
        <motion.div
          variants={reveal}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-12% 0px" }}
          className="text-center"
        >
          <span className="eyebrow">Questions</span>
          <h2 className="display-2 mx-auto mt-3 max-w-2xl font-display font-bold tracking-tight">
            Frequently asked
          </h2>
        </motion.div>
        <div className="mt-12">
          <FAQ items={FAQS} />
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-5xl px-5 py-20">
        <motion.div
          variants={reveal}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="glass neu-lg relative overflow-hidden p-10 text-center sm:p-16"
        >
          <Zap className="mx-auto h-8 w-8 text-primary" />
          <h2 className={`mx-auto mt-4 max-w-2xl text-3xl font-bold tracking-tight sm:text-5xl ${grotesk}`}>
            Your best semester starts now.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-muted">
            Set up your subjects in minutes. Import a syllabus and watch STiDY do the rest.
          </p>
          <Link
            href="/signup"
            className="neu-btn group mt-8 inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold text-primary"
          >
            Create your free account
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </motion.div>
      </section>

      {/* Footer — exactly one logo lockup (mark + custom-styled "STiDY" text). */}
      <footer className="mx-auto flex max-w-5xl flex-col items-center gap-2 px-5 py-10 text-center">
        <div className="flex items-center gap-2">
          <Logo size={26} wordmark={false} />
          <span className={`font-bold tracking-tight ${grotesk}`}>STiDY</span>
        </div>
        <p className="text-xs text-muted">Built with care for students · © {new Date().getFullYear()} STiDY</p>
      </footer>
    </div>
  );
}
