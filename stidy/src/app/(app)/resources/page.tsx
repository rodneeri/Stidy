import { ResourcesManager } from "@/features/resources/ResourcesManager";

export default async function ResourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string }>;
}) {
  const { subject } = await searchParams;
  return <ResourcesManager initialSubject={subject ?? null} />;
}
