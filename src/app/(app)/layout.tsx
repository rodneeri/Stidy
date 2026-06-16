import { redirect } from "next/navigation";
import { MeshBackground } from "@/components/layout/MeshBackground";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { HelpButton } from "@/components/help/HelpButton";
import { AssistantChat } from "@/features/assistant/AssistantChat";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { PageTransition } from "@/components/layout/PageTransition";
import { createClient } from "@/lib/supabase/server";

/** Authenticated app shell: ambient mesh backdrop + persistent sidebar + topbar. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const displayName =
    (user.user_metadata?.full_name as string | undefined) ?? user.email ?? "Student";

  return (
    <div className="relative flex min-h-screen">
      <MeshBackground />
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar displayName={displayName} email={user.email ?? ""} />
        <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
      <HelpButton />
      <AssistantChat />
      <CommandPalette />
    </div>
  );
}
