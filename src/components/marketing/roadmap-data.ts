/**
 * STiDY — "Under Development" roadmap data.
 * ============================================================================
 * HOW TO UPDATE THIS SECTION (read me first):
 *
 * This file is the ONLY thing you need to edit to change what shows up in the
 * landing page's "Under Development" / Roadmap section. The component that
 * renders it (`RoadmapSection.tsx`) just maps over the `ROADMAP` array below —
 * no other file needs to change for routine updates.
 *
 * To add an item: copy any object in the array and edit its fields.
 * To remove an item: delete its object from the array.
 * To reorder: reorder the objects (the list renders top-to-bottom, grouped by
 * `status`, in the status order defined by STATUS_ORDER).
 *
 * Fields:
 * - id        — stable unique slug (kebab-case). Used as the React key.
 * - title     — short feature name, shown bold.
 * - body      — one or two sentences. Plain text, no markdown.
 * - status    — one of "shipped" | "in-progress" | "planned" | "exploring".
 *               Drives both the icon and the colored pill label.
 * - eta       — optional human string, e.g. "Q3 2026" or "This month". Leave
 *               undefined to hide the ETA pill entirely.
 *
 * That's it — save the file and the landing page picks it up automatically.
 * ============================================================================
 */

export type RoadmapStatus = "shipped" | "in-progress" | "planned" | "exploring";

export interface RoadmapItem {
  id: string;
  title: string;
  body: string;
  status: RoadmapStatus;
  eta?: string;
}

/** Render order for status groups (top to bottom). */
export const STATUS_ORDER: RoadmapStatus[] = ["in-progress", "planned", "exploring", "shipped"];

export const STATUS_LABEL: Record<RoadmapStatus, string> = {
  "in-progress": "In progress",
  planned: "Planned",
  exploring: "Exploring",
  shipped: "Shipped",
};

export const ROADMAP: RoadmapItem[] = [
  {
    id: "mobile-companion",
    title: "Mobile companion app",
    body: "A lightweight iOS/Android shell for quick grade checks, timetable glances, and focus-timer control on the go.",
    status: "in-progress",
    eta: "Q3 2026",
  },
  {
    id: "calendar-sync",
    title: "Two-way calendar sync",
    body: "Push your STiDY timetable and exam dates straight into Google Calendar / Outlook, and pull events back in.",
    status: "in-progress",
    eta: "This month",
  },
  {
    id: "shared-vaults",
    title: "Shared resource vaults",
    body: "Let a study group share a single Resource Vault with permissions, instead of everyone re-uploading the same PDFs.",
    status: "planned",
    eta: "Q4 2026",
  },
  {
    id: "voice-flashcards",
    title: "Voice-mode flashcards",
    body: "Run a Study Lab review session hands-free — STiDY reads the prompt aloud and listens for your answer.",
    status: "planned",
  },
  {
    id: "lms-import",
    title: "Direct LMS import",
    body: "Connect Moodle / Canvas so syllabi, due dates, and grades import automatically instead of via file upload.",
    status: "exploring",
  },
  {
    id: "offline-mode",
    title: "Offline-first mode",
    body: "Keep working on flashcards and notes with no connection; STiDY reconciles everything once you're back online.",
    status: "exploring",
  },
];
