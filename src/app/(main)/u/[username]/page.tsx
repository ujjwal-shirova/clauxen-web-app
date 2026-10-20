export default async function UserProfileRoute({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  await params;
  return null;
}
