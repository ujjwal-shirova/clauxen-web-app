import { PluginsDirectoryView } from "@/connectors/ui/plugins/plugins-directory-view";
import { getPluginDirectory } from "@/connectors/server/plugins/catalog";

export default async function PluginsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const category = Array.isArray(params.category)
    ? params.category[0]
    : params.category;

  const initialData = await getPluginDirectory({
    category: category ?? null,
    overview: !category,
  });

  return (
    <PluginsDirectoryView
      initialCategory={initialData.category?.slug ?? null}
      initialData={initialData}
    />
  );
}
