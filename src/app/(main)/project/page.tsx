"use client";

import { Suspense, useState } from "react";
import { CreateProjectForm } from "@/components/create-project-form";
import { useProjects } from "@/hooks/use-projects";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
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
  const { toast } = useToast();
  const projects = useProjects(Boolean(auth.user?.id));
  const [isCreating, setIsCreating] = useState(false);

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
      toast({
        title: "Could not create project",
        description: "Enter a project name and try again.",
        variant: "destructive",
      });
    } catch {
      toast({
        title: "Could not create project",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
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
        />
      </div>
    </div>
  );
}
