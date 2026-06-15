import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// Need a real user id (FK + RLS owner).
const { data: list, error: uErr } = await sb.auth.admin.listUsers();
if (uErr) throw uErr;
const user = list.users[0];
if (!user) {
  console.log("No users yet — sign up in the app first, then re-run.");
  process.exit(0);
}
console.log("Using user:", user.email);

// 1. Subject
const { data: subject } = await sb
  .from("subjects")
  .insert({ user_id: user.id, name: "TEST — delete me" })
  .select()
  .single();

// 2. Grading structure: Midterm 30, Final 40, Homework 30
const cats = [
  { id: crypto.randomUUID(), name: "Midterm", weight: 30 },
  { id: crypto.randomUUID(), name: "Final", weight: 40 },
  { id: crypto.randomUUID(), name: "Homework", weight: 30 },
];
await sb.from("grading_structures").insert({
  user_id: user.id,
  subject_id: subject.id,
  categories: cats,
  target_grade: 90,
});

// 3. Grades: Midterm 80/100, Homework 90/100 (Final ungraded)
await sb.from("grades").insert([
  { user_id: user.id, subject_id: subject.id, category_id: cats[0].id, title: "Midterm 1", score: 80, max_score: 100 },
  { user_id: user.id, subject_id: subject.id, category_id: cats[2].id, title: "HW set", score: 90, max_score: 100 },
]);

// 4. Ask the DB function (normalised over graded categories → (80*30+90*30)/60 = 85)
const { data: grade } = await sb.rpc("stidy_subject_grade", {
  p_subject_id: subject.id,
  p_include_projected: false,
});
console.log("DB weighted grade:", grade, "(expected 85)");

// 5. Cached column (trigger)
const { data: subAfter } = await sb
  .from("subjects")
  .select("current_grade")
  .eq("id", subject.id)
  .single();
console.log("Cached subjects.current_grade:", subAfter.current_grade, "(expected 85)");

// cleanup (cascade removes structure + grades)
await sb.from("subjects").delete().eq("id", subject.id);
console.log("Cleaned up.", Number(grade) === 85 ? "✅ PASS" : "❌ MISMATCH");
