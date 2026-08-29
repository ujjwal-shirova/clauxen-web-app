import { PluginsDirectoryView } from "@/components/plugins/plugins-directory-view";

export default async function PluginsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const category = Array.isArray(params.category)
    ? params.category[0]
    : params.category;

  return <PluginsDirectoryView initialCategory={category ?? null} />;
}
