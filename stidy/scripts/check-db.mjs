import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const tables = [
  "profiles",
  "careers",
  "subjects",
  "grading_structures",
  "grades",
  "resources",
  "tasks",
  "flashcards",
  "study_logs",
];

for (const t of tables) {
  const { error, count } = await sb.from(t).select("*", { count: "exact", head: true });
  console.log(`${t.padEnd(20)} ${error ? "MISSING → " + error.message : "OK (" + count + " rows)"}`);
}

const { error: fnErr } = await sb.rpc("stidy_subject_grade", {
  p_subject_id: "00000000-0000-0000-0000-000000000000",
  p_include_projected: false,
});
console.log(`fn stidy_subject_grade ${fnErr ? "ERR → " + fnErr.message : "OK"}`);
