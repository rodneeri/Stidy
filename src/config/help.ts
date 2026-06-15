export interface HelpTopic {
  title: string;
  intro: string;
  points: { heading: string; body: string }[];
}

export const HELP: Record<string, HelpTopic> = {
  dashboard: {
    title: "Command Center — Manual",
    intro: "The dashboard is a live overview of your whole academic life. Nothing here is mock data — it all comes from what you enter elsewhere.",
    points: [
      { heading: "Weighted Avg", body: "The average of every subject's current grade. Empty until you add grades in the Grade Engine." },
      { heading: "Subjects", body: "How many courses you track. Tap to manage them." },
      { heading: "Next Exam", body: "The soonest item flagged as an exam in the Timetable. Tap to open the Timetable." },
      { heading: "Tasks", body: "Count of open (not-done) tasks. Completed ones drop off automatically." },
      { heading: "Subject dials", body: "A ring per subject showing its current weighted grade. Tap to jump into the Grade Engine." },
      { heading: "Everything is a shortcut", body: "Each card and section navigates to the tool that owns that data." },
    ],
  },
  grades: {
    title: "Grade Engine — Manual",
    intro: "Track exactly where you stand in every course and plan what you need. The dial is your live weighted grade.",
    points: [
      { heading: "1 · Add a subject", body: "Use the box in the left column (or import a syllabus). Switch subjects by clicking them; the ⋮ menu edits name/code/professor or deletes." },
      { heading: "2 · Categories & weights", body: "Add the grading buckets (e.g. Midterm 30%, Final 40%, Homework 30%). The category weights are % of the FINAL grade and should total 100%." },
      { heading: "3a · Grade a whole category", body: "Type a number in the category's grade box to score the whole bucket at once — it overrides its sub-items. Clear it to go back to item-based." },
      { heading: "3b · Or grade item by item", body: "Add items under a category (e.g. Test 1, Test 2). Each item can carry a weight WITHIN its category (the 'wt %' field). Type each item's score/max inline." },
      { heading: "Weighting", body: "A category's grade = the weighted average of its items (or your direct category grade). The final = each category average × its weight, normalised over what's graded so far." },
      { heading: "What-If", body: "Drag the slider: 'if I score X% on everything still ungraded, my final becomes…'." },
      { heading: "Target Solver", body: "Enter the final you want; it tells you the average you need on the remaining weight (and warns if it's impossible)." },
      { heading: "AI — Import syllabus", body: "Upload your syllabus/class guide; AI reads it and builds the categories (and sub-gradings) automatically." },
      { heading: "AI — Analyze", body: "'Analyze my grades' gives honest, specific insight: strengths, risks, and what to prioritise." },
    ],
  },
  subjects: {
    title: "Subjects — Manual",
    intro: "The home for your courses — identity, details, and a fast route into grades.",
    points: [
      { heading: "New subject", body: "Click 'New subject' and set a name, code, semester, professor, and a colour used across the app." },
      { heading: "Edit / delete", body: "The pencil edits a card; the trash (two-click to confirm) removes the subject and its grades." },
      { heading: "Open in Grades", body: "'Grades' on a card opens the Grade Engine for that subject." },
      { heading: "Auto-created", body: "Importing a syllabus in the Grade Engine, or uploading resources, can create subjects for you." },
    ],
  },
  resources: {
    title: "Resource Vault — Manual",
    intro: "Drop any course file and STiDY recognises what it is, which subject it belongs to, and files it for you. Your original filenames are always kept.",
    points: [
      { heading: "Upload", body: "Drag-and-drop (or click) one or many files. PDFs and images are actually read by AI; other types are judged by name and type." },
      { heading: "Category: Theory", body: "Lecture notes, slides, textbooks, readings — the material you learn from." },
      { heading: "Category: Practice", body: "Problem sets, labs, exercises, worksheets — things you do to practise." },
      { heading: "Category: Exam", body: "Tests, midterms, finals, past papers, mock exams — assessment material." },
      { heading: "Category: Admin", body: "Syllabus, schedule, policies, course info — the organisational paperwork." },
      { heading: "Category: Other", body: "Anything that doesn't fit the above." },
      { heading: "Folders", body: "With subjects set, files group into per-subject folders. The pills on each folder show how many docs of each category it holds." },
      { heading: "Expand & open", body: "Click a folder to expand it (grouped by category) and open any file in the built-in viewer (PDF, image, video)." },
      { heading: "The flying file", body: "After upload, a file icon warps into its destination folder — that's STiDY showing you where it filed it." },
    ],
  },
  timetable: {
    title: "Timetable — Manual",
    intro: "Your to-do list and exam schedule, grouped by when things are due.",
    points: [
      { heading: "Add", body: "Type a title, pick a date/time, optionally a subject and priority, and tick 'Exam' for tests. Press Enter or Add." },
      { heading: "Smart grouping", body: "Items sort into Overdue, Today, This week, Later, and Someday (no date) so you always see what matters first." },
      { heading: "Complete", body: "Tick the circle to mark done — it moves to Completed and leaves your dashboard." },
      { heading: "Feeds the dashboard", body: "Your 'Next exam' and 'What's next' come straight from here." },
    ],
  },
  flashcards: {
    title: "Study Lab — Manual",
    intro: "Turn a subject into practice: AI-generated flashcards and full written/practical exams.",
    points: [
      { heading: "Pick a subject", body: "Choose the course you want to study — the Lab uses that subject's materials as context." },
      { heading: "Generate", body: "Open the generator and choose what to make: Flashcards, a Written exam, or a Practical exam (great for maths — worked problems with full solutions)." },
      { heading: "Tune it", body: "Set difficulty and how many items, and add a custom instruction (e.g. 'focus on chapter 4, integration by parts')." },
      { heading: "Flashcards", body: "Saved as a visual stack. Tap it to shuffle, then flip each card and send it to the back. Edit any card's text or delete the whole stack from inside." },
      { heading: "Review (SRS)", body: "Hit 'Review due' to study cards that are due. Rating Again/Good/Easy schedules each card and feeds your reviews-today, accuracy and streak stats." },
      { heading: "Exams", body: "Each generated exam opens on its own; reveal answers per question. Saved exams can be renamed, reopened, or deleted." },
    ],
  },
  focus: {
    title: "Focus — Manual",
    intro: "A deep-work timer that logs your study hours and keeps you company.",
    points: [
      { heading: "Presets", body: "Pomodoro (25/5) or Deep work (50/10), or pick Custom and dial in any hours/minutes/seconds on the wheel." },
      { heading: "End chime", body: "A calm, repeating chime plays when a phase ends — attention-catching but relaxed." },
      { heading: "Run it", body: "Start/pause, skip to the next phase, or reset. Completed focus sessions log automatically." },
      { heading: "Log to a subject", body: "Choose a subject so your study hours are attributed to it." },
      { heading: "Stats & burnout", body: "See today's and this week's hours; a gentle nudge appears after 4h+ in a day." },
      { heading: "Ambience", body: "White, pink, or brown noise (generated live, no downloads) with a volume control." },
    ],
  },
  settings: {
    title: "Settings — Manual",
    intro: "Make STiDY yours.",
    points: [
      { heading: "Themes", body: "Four neumorphic themes (two light, two dark). Your choice saves to this device." },
      { heading: "Quick switch", body: "The palette button in the top bar changes theme from anywhere." },
      { heading: "Guide", body: "The 'How STiDY works' section summarises every tool. This ? button always explains the page you're on." },
    ],
  },
};

/** Resolve the help topic for the current route. */
export function helpFor(pathname: string): HelpTopic {
  const seg = pathname.split("/").filter(Boolean)[0] ?? "dashboard";
  return HELP[seg] ?? HELP.dashboard;
}
