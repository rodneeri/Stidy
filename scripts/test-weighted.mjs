import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const { data: list } = await sb.auth.admin.listUsers();
const user = list.users[0];
if (!user) {
  console.log("No user — sign up first.");
  process.exit(0);
}

const { data: subject } = await sb
  .from("subjects")
  .insert({ user_id: user.id, name: "TEST weighted — delete me" })
  .select()
  .single();

const cat = { id: crypto.randomUUID(), name: "Continuous", weight: 100 };
await sb.from("grading_structures").insert({
  user_id: user.id,
  subject_id: subject.id,
  categories: [cat],
});

// Test 1: 80/100 weight 70, Test 2: 60/100 weight 30 → (80*70 + 60*30)/100 = 74
await sb.from("grades").insert([
  { user_id: user.id, subject_id: subject.id, category_id: cat.id, title: "Test 1", score: 80, max_score: 100, weight: 70 },
  { user_id: user.id, subject_id: subject.id, category_id: cat.id, title: "Test 2", score: 60, max_score: 100, weight: 30 },
]);

const { data: grade } = await sb.rpc("stidy_subject_grade", {
  p_subject_id: subject.id,
  p_include_projected: false,
});

await sb.from("subjects").delete().eq("id", subject.id);

console.log(`DB weighted grade: ${grade} (expected 74; equal-avg would be 70)`);
console.log(Number(grade) === 74 ? "✅ PASS — weighted function is live" : "❌ Not weighted — run the create-or-replace function SQL");
