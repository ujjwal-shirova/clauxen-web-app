import { projectDocumentMetadata } from "@/server/projects/project-document-metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return projectDocumentMetadata(projectId);
}

export default function ProjectIdLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
