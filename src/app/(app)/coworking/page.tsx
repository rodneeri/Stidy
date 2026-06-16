import { createClient } from "@/lib/supabase/server";
import { CoworkingHub } from "@/features/coworking/CoworkingHub";

export default async function CoworkingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ?? user?.email?.split("@")[0] ?? "Student";
  return <CoworkingHub userId={user!.id} displayName={displayName} />;
}
