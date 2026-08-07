"use client";

import { Suspense, useState } from "react";
import { CreateProjectForm } from "@/components/create-project-form";
import { useProjects } from "@/hooks/use-projects";
import { useAuth } from "@/hooks/use-auth";
import { APP_ROUTES } from "@/lib/app-routes";
import { useInstantNavigate } from "@/hooks/use-instant-navigate";

export default function ProjectCreateRoutePage() {
  return (
    <Suspense fallback={null}>
      <ProjectCreateContent />
    </Suspense>
  );
}

function ProjectCreateContent() {
  const instantNavigate = useInstantNavigate();
  const auth = useAuth();
  const projects = useProjects(Boolean(auth.user?.id));
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const handleCreate = async ({
    name,
    description,
    icon,
  }: {
    name: string;
    description: string;
    icon: string;
  }) => {
    setIsCreating(true);
    setCreateError(null);
    try {
      const project = await projects.createProject({
        name,
        description: description || undefined,
        icon,
      });
      if (project) {
        instantNavigate(APP_ROUTES.project(project.id), { replace: true });
        return;
      }
      setCreateError("Enter a project name and try again.");
    } catch {
      setCreateError("Couldn’t create the project right now. Please retry.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-y-auto bg-white">
      <div className="mx-auto flex w-full max-w-[720px] flex-1 flex-col items-center justify-center px-4 py-10 sm:px-6">
        <CreateProjectForm
          onSubmit={handleCreate}
          cancelHref={APP_ROUTES.newChat}
          isSubmitting={isCreating}
          errorMessage={createError}
        />
      </div>
    </div>
  );
}
