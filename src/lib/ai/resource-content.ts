import "server-only";
import type { createClient } from "@/lib/supabase/server";

/**
 * Shared resource grounding. Every AI feature that "answers from your materials"
 * (Study Lab generate/solve, chat, …) must read the ACTUAL file content, not just
 * titles. This downloads each filed resource from Supabase Storage and extracts
 * its text (PDF + text formats), budgeted so it stays inside the serverless limit.
 *
 * Works for text-only providers (NVIDIA/Groq) too, because we hand the model
 * extracted TEXT — not file parts.
 */

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

// Budgets — keep total context bounded so extraction + the AI call fit in 60s.
const MAX_FILES_READ = 6; // how many files we actually download + parse
const MAX_CHARS_PER_FILE = 6000;
const TOTAL_BUDGET = 24000;

function decodeText(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  } catch {
    return "";
  }
}

async function extractPdf(bytes: Uint8Array): Promise<string> {
  try {
    // Lazy + dynamic so unpdf never leaks into a client bundle.
    const { getDocumentProxy, extractText } = await import("unpdf");
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: true });
    return Array.isArray(text) ? text.join("\n") : String(text ?? "");
  } catch {
    return "";
  }
}

function isTextLike(mime: string, title: string): boolean {
  return (
    /^text\//i.test(mime) ||
    /(json|csv|markdown|xml|javascript|typescript|plain)/i.test(mime) ||
    /\.(txt|md|markdown|csv|json|tex|rtf|log)$/i.test(title)
  );
}

/** Extract plain text from a resource's bytes. Returns "" when not extractable. */
export async function extractResourceText(
  bytes: Uint8Array,
  mime: string,
  title: string,
): Promise<string> {
  if (/pdf/i.test(mime) || /\.pdf$/i.test(title)) return extractPdf(bytes);
  if (isTextLike(mime, title)) return decodeText(bytes);
  return ""; // images / docx / pptx — no text extraction yet (TODO: OCR / mammoth)
}

interface BuildOpts {
  subjectId?: string | null;
  /** Optional narrowing — when omitted, all of the subject's resources are used. */
  resourceIds?: string[];
}

interface ResourceRow {
  id: string;
  title: string;
  kind: string;
  mime_type: string | null;
  storage_path: string | null;
  url: string | null;
  meta: { summary?: string } | null;
}

/**
 * Build a grounding block containing the real text of a subject's filed
 * resources. Falls back to a one-line summary (or the link) for files we can't
 * parse or once the budget is spent.
 */
export async function buildResourceContext(
  supabase: ServerSupabase,
  opts: BuildOpts,
): Promise<string> {
  let q = supabase
    .from("resources")
    .select("id, title, kind, mime_type, storage_path, url, meta")
    .limit(40);
  if (opts.subjectId) q = q.eq("subject_id", opts.subjectId);
  if (opts.resourceIds?.length) q = q.in("id", opts.resourceIds);

  const { data } = await q;
  const rows = (data ?? []) as ResourceRow[];
  if (rows.length === 0) return "(no uploaded materials yet)";

  // Download + parse the first batch in parallel; the rest contribute title+summary.
  const toRead = rows.slice(0, MAX_FILES_READ);
  const texts = await Promise.all(
    toRead.map(async (r): Promise<string> => {
      if (!r.storage_path) return "";
      try {
        const { data: blob } = await supabase.storage.from("resources").download(r.storage_path);
        if (!blob) return "";
        const bytes = new Uint8Array(await blob.arrayBuffer());
        return (await extractResourceText(bytes, r.mime_type ?? "", r.title)).trim();
      } catch {
        return "";
      }
    }),
  );

  const blocks: string[] = [];
  let total = 0;
  rows.forEach((r, i) => {
    const header = `### [${r.kind}] ${r.title}`;
    let body = "";
    const text = i < texts.length ? texts[i] : "";
    if (text && total < TOTAL_BUDGET) {
      const slice = text.slice(0, Math.min(MAX_CHARS_PER_FILE, TOTAL_BUDGET - total));
      total += slice.length;
      body = slice;
    } else if (r.meta?.summary) {
      body = r.meta.summary;
    } else if (r.url) {
      body = `(link) ${r.url}`;
    }
    blocks.push(`${header}\n${body || "(no extractable content)"}`);
  });

  return blocks.join("\n\n");
}
