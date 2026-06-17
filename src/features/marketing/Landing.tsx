"use client";

import Link from "next/link";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import {
  GraduationCap,
  FolderOpen,
  CalendarDays,
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

const grotesk = "font-[family-name:var(--font-grotesk)]";

const FEATURES = [
  {
    icon: GraduationCap,
    title: "Grade Intelligence Engine",
    body: "Weighted averages, What-If sliders, and a Target Solver that tells you exactly what you need on the final. Import a syllabus and AI builds the structure for you.",
    span: "lg:col-span-2",
  },
  {
    icon: Users,
    title: "Coworking Hub",
    body: "Live co-study rooms with presence, a shared focus timer, and chat. Study with classmates, in sync.",
    span: "",
  },
  {
    icon: FolderOpen,
    title: "Resource Vault",
    body: "Drop your files — AI auto-classifies them by subject and type. In-app viewer included.",
    span: "",
  },
  {
    icon: FlaskConical,
    title: "Study Lab",
    body: "AI flashcards and practice exams grounded in your own materials, with spaced-repetition review.",
    span: "",
  },
  {
    icon: Timer,
    title: "Deep-Work Focus",
    body: "Pomodoro + stopwatch, Web-Audio ambience, study logging, and a burnout nudge when you overdo it.",
    span: "",
  },
  {
    icon: CalendarDays,
    title: "Timetable",
    body: "Tasks and exams that power your dashboard's next-exam countdown and what's-next.",
    span: "",
  },
  {
    icon: Sparkles,
    title: "Ask STiDY",
    body: "An assistant that actually knows your semester — subjects, grades, deadlines, and resources.",
    span: "lg:col-span-2",
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0 },
};

export function Landing() {
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const heroY = useTransform(scrollYProgress, [0, 0.2], [0, reduce ? 0 : -60]);

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <MeshBackground />

      {/* Nav */}
      <header className="sticky top-0 z-30 px-5 py-3">
        <nav className="glass mx-auto flex max-w-5xl items-center gap-3 rounded-full px-4 py-2.5">
          <Logo size={34} wordmark={false} />
          <span className={`text-lg font-bold tracking-tight ${grotesk}`}>STiDY</span>
          <div className="ml-auto flex items-center gap-2">
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
        <motion.div style={{ y: heroY }}>
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
          <p className="mt-4 text-xs text-muted">Free to start · Built for the Spanish system — EVAU, cuatrimestres, oposiciones</p>
        </motion.div>

        {/* Floating hero visual */}
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.35 }}
          className="relative mx-auto mt-16 max-w-3xl"
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
      </section>

      {/* Features */}
      <section className="mx-auto max-w-5xl px-5 py-16">
        <motion.h2
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          variants={fadeUp}
          transition={{ duration: 0.5 }}
          className={`text-center text-3xl font-bold tracking-tight sm:text-4xl ${grotesk}`}
        >
          Everything your semester needs
        </motion.h2>
        <motion.p
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          variants={fadeUp}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="mx-auto mt-3 max-w-xl text-center text-muted"
        >
          Stop juggling a planner, a grade spreadsheet, an LMS, and five flashcard apps. STiDY is one place.
        </motion.p>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-60px" }}
              variants={fadeUp}
              transition={{ duration: 0.5, delay: (i % 3) * 0.06 }}
              className={`glass group flex flex-col gap-3 p-6 transition-transform hover:-translate-y-1 ${f.span}`}
            >
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/15 text-primary">
                <f.icon className="h-5 w-5" />
              </span>
              <h3 className={`text-lg font-bold tracking-tight ${grotesk}`}>{f.title}</h3>
              <p className="text-sm text-muted">{f.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Why strip */}
      <section className="mx-auto max-w-5xl px-5 py-16">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { icon: Brain, title: "AI that knows you", body: "Resilient Gemini + Groq + NVIDIA chain, grounded in your own subjects and files." },
            { icon: Palette, title: "Nine living themes", body: "A neumorphic design system that re-skins instantly — from midnight teal to chalkboard." },
            { icon: ShieldCheck, title: "Your data, yours", body: "Row-level security, private file storage, signed links. Only you see your work." },
          ].map((c, i) => (
            <motion.div
              key={c.title}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              variants={fadeUp}
              transition={{ duration: 0.5, delay: i * 0.06 }}
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

      {/* CTA */}
      <section className="mx-auto max-w-5xl px-5 py-20">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          variants={fadeUp}
          transition={{ duration: 0.6 }}
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

      {/* Footer */}
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
