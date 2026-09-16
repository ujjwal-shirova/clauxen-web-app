import { redirect } from "next/navigation";

export default async function PluginsRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const item = Array.isArray(value) ? value[0] : value;
    if (item) query.set(key, item);
  }
  const suffix = query.toString();
  redirect(suffix ? `/connectors?${suffix}` : "/connectors");
}
