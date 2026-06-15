import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// If the column exists this selects fine; if not, PostgREST errors.
const { error } = await sb.from("grades").select("id, weight").limit(1);
if (error) {
  console.log("weight column → MISSING:", error.message);
} else {
  console.log("weight column → ✅ EXISTS on public.grades");
}
