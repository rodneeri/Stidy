import { redirect } from "next/navigation";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  // Email-confirmation / OAuth links land here with a ?code= to exchange.
  if (code) redirect(`/auth/callback?code=${code}`);
  redirect("/dashboard");
}
