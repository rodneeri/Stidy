import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const { data, error } = await sb.storage.listBuckets();
if (error) {
  console.log("ERROR:", error.message);
} else {
  const r = data.find((b) => b.id === "resources");
  console.log("buckets:", data.map((b) => b.id).join(", ") || "(none)");
  console.log("resources bucket:", r ? `✅ exists (public=${r.public})` : "❌ MISSING");
}
