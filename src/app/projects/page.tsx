"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useProjects } from "@/frontend/hooks/use-projects";
import { useAuth } from "@/frontend/hooks/use-auth";
import { ProjectsView } from "@/frontend/components/projects-view";
import { CreateProjectDialog } from "@/frontend/components/create-project-dialog";
import { useToast } from "@/frontend/hooks/use-toast";
import type { ApiProject } from "@/frontend/lib/api/projects";

export default function ProjectsPage() {
  const router = useRouter();
  const auth = useAuth();
  const { toast } = useToast();
  const projects = useProjects(auth.isAuthenticated);
  const [createOpen, setCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const openProject = (project: ApiProject) => {
    router.push(`/projects/${project.id}`);
  };

  const handleCreate = async ({
    name,
    description,
  }: {
    name: string;
    description: string;
  }) => {
    setIsCreating(true);
    try {
      const project = await projects.createProject({
        name,
        description: description || undefined,
      });
      if (project) {
        setCreateOpen(false);
        openProject(project);
      } else {
        toast({
          title: "Could not create project",
          description: "Enter a project name and try again.",
          variant: "destructive",
        });
      }
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
    <>
      <ProjectsView
        projects={projects.projects}
        loading={projects.loading}
        onNewProject={() => setCreateOpen(true)}
        onOpenProject={(projectId) => {
          const project = projects.projects.find((p) => p.id === projectId);
          if (project) openProject(project);
        }}
      />

      <CreateProjectDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        isSubmitting={isCreating}
        onSubmit={handleCreate}
      />
    </>
  );
}
