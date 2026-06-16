import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Landing } from "@/features/marketing/Landing";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  // Email-confirmation / OAuth links land here with a ?code= to exchange.
  if (code) redirect(`/auth/callback?code=${code}`);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  // Logged-out visitors get the marketing landing page.
  return <Landing />;
}
