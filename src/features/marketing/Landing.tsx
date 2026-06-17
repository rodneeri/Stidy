"use client";

import type { ComponentType } from "react";
import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Brain,
  Check,
  GraduationCap,
  LogIn,
  NotebookPen,
  Sparkles,
  Timer,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";

import dashboardImage from "../../../docs/screens/dashboard.png";
import gradeEngineImage from "../../../docs/screens/grade-engine.png";
import resourcesImage from "../../../docs/screens/resources.png";
import timetableImage from "../../../docs/screens/timetable.png";

type Icon = ComponentType<{ className?: string }>;

const modules: {
  title: string;
  description: string;
  icon: Icon;
}[] = [
  {
    title: "Grade intelligence",
    description: "Weighted averages, what-if sliders, and target scores that update as the term changes.",
    icon: GraduationCap,
  },
  {
    title: "Syllabus parsing",
    description: "Turn course files into grading structures, deadlines, and study material with AI assistance.",
    icon: NotebookPen,
  },
  {
    title: "Resource vault",
    description: "Keep PDFs, notes, links, and class files attached to the subject where they belong.",
    icon: BookOpen,
  },
  {
    title: "Focus sessions",
    description: "Run deep-work blocks, review cards, and watch your next exam stay in view.",
    icon: Timer,
  },
];

const workflow = [
  "Import syllabus",
  "Track grades",
  "Generate study sets",
  "Plan the week",
];

const showcases: {
  title: string;
  copy: string;
  image: StaticImageData;
  alt: string;
}[] = [
  {
    title: "Know what every assignment is worth",
    copy: "The grade engine turns messy course weights into a working model, so students can decide where effort matters most.",
    image: gradeEngineImage,
    alt: "STiDY grade engine showing weighted course components and grade projections",
  },
  {
    title: "Keep course material close to the work",
    copy: "Resources sit beside the subjects, tasks, and exams they support instead of disappearing into a downloads folder.",
    image: resourcesImage,
    alt: "STiDY resource vault with organized academic files",
  },
  {
    title: "Make the semester visible",
    copy: "The timetable connects tasks, exam dates, and study sessions into one view students can actually scan.",
    image: timetableImage,
    alt: "STiDY timetable showing academic tasks and exam planning",
  },
];

export function Landing() {
  return (
    <main data-theme="chalkboard" className="min-h-screen overflow-hidden bg-background text-foreground">
      <section className="relative border-b border-foreground/10">
        <div className="mesh-bg" />
        <div className="relative mx-auto flex min-h-[88svh] w-full max-w-7xl flex-col px-5 py-6 sm:px-8 lg:px-10">
          <nav className="flex items-center justify-between gap-4">
            <Logo size={42} />
            <div className="hidden items-center gap-7 text-sm font-medium text-muted md:flex">
              <a className="transition hover:text-foreground" href="#modules">
                Modules
              </a>
              <a className="transition hover:text-foreground" href="#workflow">
                Workflow
              </a>
              <a className="transition hover:text-foreground" href="#screens">
                Screens
              </a>
            </div>
            <Link
              href="/login"
              className="neu-btn inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold"
            >
              <LogIn className="h-4 w-4" />
              Sign in
            </Link>
          </nav>

          <div className="grid flex-1 items-center gap-12 py-14 lg:grid-cols-[0.9fr_1.1fr] lg:py-10">
            <div className="max-w-3xl">
              <p className="eyebrow mb-5 inline-flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Personal academic OS
              </p>
              <h1 className="display-1 max-w-[10ch]">
                STiDY keeps the whole semester in view.
              </h1>
              <p className="mt-6 max-w-[58ch] text-lg leading-8 text-muted">
                Grades, syllabi, resources, flashcards, focus sessions, and AI help in one command
                center built for university work.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/dashboard"
                  className="neu-btn inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-primary"
                >
                  Open dashboard
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/signup"
                  className="inline-flex items-center justify-center gap-2 rounded-[var(--radius)] px-5 py-3 text-sm font-semibold text-foreground/85 transition hover:text-primary"
                >
                  Create account
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <dl className="mt-10 grid max-w-xl grid-cols-3 gap-4">
                {[
                  ["8.7", "grade model"],
                  ["24m", "focus block"],
                  ["17", "day streak"],
                ].map(([value, label]) => (
                  <div key={label} className="neu-inset px-4 py-3">
                    <dt className="font-mono text-2xl font-semibold text-primary" data-numeric>
                      {value}
                    </dt>
                    <dd className="mt-1 text-xs font-medium text-muted">{label}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="relative">
              <div className="absolute -left-6 top-8 hidden w-28 -rotate-6 rounded-[var(--radius-md)] bg-primary/14 px-4 py-3 text-sm font-semibold text-primary shadow-[0_18px_55px_hsl(var(--primary)/0.16)] lg:block">
                due next
                <span className="mt-1 block font-mono text-2xl" data-numeric>
                  09:30
                </span>
              </div>
              <div className="neu-lg hairline relative overflow-hidden p-3">
                <Image
                  src={dashboardImage}
                  alt="STiDY dashboard with grades, tasks, flashcards, and focus tools"
                  priority
                  placeholder="blur"
                  sizes="(min-width: 1024px) 56vw, 100vw"
                  className="aspect-[16/10] rounded-[calc(var(--radius)+0.05rem)] object-cover object-left-top"
                />
              </div>
              <div className="neu absolute -bottom-6 right-4 hidden w-56 p-4 text-sm lg:block">
                <div className="flex items-center gap-2 font-semibold">
                  <Brain className="h-4 w-4 text-primary" />
                  Study set ready
                </div>
                <p className="mt-2 text-muted">42 flashcards from this week&apos;s resources.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="modules" className="border-b border-foreground/10 px-5 py-16 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="eyebrow mb-3">Core modules</p>
            <h2 className="display-2">A study system with fewer loose ends.</h2>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {modules.map((module) => {
              const ModuleIcon = module.icon;

              return (
                <article key={module.title} className="neu lift hairline flex min-h-64 flex-col p-6">
                  <ModuleIcon className="h-6 w-6 text-primary" />
                  <h3 className="mt-8 text-2xl font-semibold tracking-[-0.02em]">
                    {module.title}
                  </h3>
                  <p className="mt-4 leading-7 text-muted">{module.description}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="workflow" className="border-b border-foreground/10 px-5 py-16 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.78fr_1fr] lg:items-start">
          <div>
            <p className="eyebrow mb-3">Workflow</p>
            <h2 className="display-2">From course file to weekly plan.</h2>
            <p className="mt-5 max-w-[54ch] text-lg leading-8 text-muted">
              STiDY is built around the real loop of a semester: parse the course, understand the
              grade, collect the material, then study before the deadline gets loud.
            </p>
          </div>
          <ol className="grid gap-4 sm:grid-cols-2">
            {workflow.map((step, index) => (
              <li key={step} className="neu-inset flex items-center gap-4 p-5">
                <span
                  className="neu grid h-11 w-11 shrink-0 place-items-center font-mono text-sm font-semibold text-primary"
                  data-numeric
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="text-lg font-semibold">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="screens" className="px-5 py-16 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div className="max-w-2xl">
              <p className="eyebrow mb-3">Product views</p>
              <h2 className="display-2">Made for the parts of studying people avoid.</h2>
            </div>
            <Link
              href="/dashboard"
              className="neu-btn inline-flex w-fit items-center gap-2 px-5 py-3 text-sm font-semibold text-primary"
            >
              Try the app
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {showcases.map((item) => (
              <article key={item.title} className="flex flex-col overflow-hidden rounded-[var(--radius)]">
                <div className="neu-lg hairline overflow-hidden p-2">
                  <Image
                    src={item.image}
                    alt={item.alt}
                    placeholder="blur"
                    sizes="(min-width: 1024px) 31vw, 100vw"
                    className="aspect-[4/3] rounded-[var(--radius-md)] object-cover object-left-top"
                  />
                </div>
                <div className="pt-5">
                  <h3 className="text-2xl font-semibold tracking-[-0.02em]">{item.title}</h3>
                  <p className="mt-3 leading-7 text-muted">{item.copy}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-foreground/10 px-5 py-8 sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-5 text-sm text-muted md:flex-row md:items-center">
          <div className="flex items-center gap-3">
            <Logo size={34} />
            <span>Built for students who want one place to think.</span>
          </div>
          <div className="flex flex-wrap items-center gap-5">
            <span className="inline-flex items-center gap-1">
              <Check className="h-3.5 w-3.5" />
              Privacy
            </span>
            <span className="inline-flex items-center gap-1">
              <Check className="h-3.5 w-3.5" />
              Terms
            </span>
          </div>
        </div>
      </footer>
    </main>
  );
}
