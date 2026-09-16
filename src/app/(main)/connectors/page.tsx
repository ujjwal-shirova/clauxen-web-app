import { Suspense } from "react";
import { PluginsDirectoryView } from "@/connectors/ui/plugins/plugins-directory-view";
import { getConnectorDirectory } from "@/connectors/server/directory";
import { ConnectorsDirectoryLoading } from "./connectors-loading";

export default function ConnectorsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<ConnectorsDirectoryLoading />}>
      <ConnectorsDirectory searchParams={searchParams} />
    </Suspense>
  );
}

async function ConnectorsDirectory({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const category = Array.isArray(params.category)
    ? params.category[0]
    : params.category;

  const initialData = await getConnectorDirectory({
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
