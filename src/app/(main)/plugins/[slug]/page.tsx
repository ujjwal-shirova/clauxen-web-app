import { redirect } from "next/navigation";

type PluginPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PluginRedirect({
  params,
  searchParams,
}: PluginPageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    const item = Array.isArray(value) ? value[0] : value;
    if (item) next.set(key, item);
  }
  const suffix = next.toString();
  redirect(
    `/connectors/${encodeURIComponent(slug)}${suffix ? `?${suffix}` : ""}`,
  );
}
