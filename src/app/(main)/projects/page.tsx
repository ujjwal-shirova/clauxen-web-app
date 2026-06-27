"use client";

import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import { ProjectsView } from "@/frontend/components/projects-view";
import { CreateProjectDialog } from "@/frontend/components/create-project-dialog";
import { useProjects } from "@/frontend/hooks/use-projects";
import { useAuth } from "@/frontend/hooks/use-auth";
import { useToast } from "@/frontend/hooks/use-toast";
import type { ApiProject } from "@/frontend/lib/api/projects";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/frontend/components/ui/alert-dialog";

export default function ProjectsListRoutePage() {
  return (
    <Suspense fallback={null}>
      <ProjectsListContent />
    </Suspense>
  );
}

function ProjectsListContent() {
  const router = useRouter();
  const auth = useAuth();
  const { toast } = useToast();
  const projects = useProjects(auth.isAuthenticated);

  const [createOpen, setCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editProject, setEditProject] = useState<ApiProject | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ApiProject | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const openProject = (projectId: string) => {
    router.push(`/projects/${projectId}`);
  };

  const handleCreate = async ({
    name,
    description,
  }: {
    name: string;
    description?: string;
  }) => {
    setIsCreating(true);
    try {
      const project = await projects.createProject({
        name,
        description: description || undefined,
      });
      if (project) {
        setCreateOpen(false);
        openProject(project.id);
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

  const handleEditSubmit = async ({
    name,
    description,
  }: {
    name: string;
    description: string;
  }) => {
    if (!editProject) return;
    setIsSavingEdit(true);
    try {
      await projects.updateProject(editProject.id, {
        name,
        description: description || undefined,
      });
      setEditProject(null);
    } catch {
      toast({
        title: "Could not update project",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const ok = await projects.deleteProject(deleteTarget.id);
      if (ok) {
        setDeleteTarget(null);
      } else {
        toast({
          title: "Could not delete project",
          description: "Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <ProjectsView
        projects={projects.projects}
        loading={projects.loading}
        onNewProject={() => setCreateOpen(true)}
        onOpenProject={openProject}
        onEditProject={setEditProject}
        onDeleteProject={setDeleteTarget}
      />

      <CreateProjectDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        isSubmitting={isCreating}
        onSubmit={handleCreate}
      />

      <CreateProjectDialog
        open={editProject != null}
        onOpenChange={(open) => {
          if (!open) setEditProject(null);
        }}
        mode="edit"
        initialName={editProject?.name ?? ""}
        initialDescription={editProject?.description ?? ""}
        isSubmitting={isSavingEdit}
        onSubmit={handleEditSubmit}
      />

      <AlertDialog
        open={deleteTarget != null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.name
                ? `"${deleteTarget.name}" will be removed from your library. Chats inside this project will not be deleted.`
                : "This project will be removed from your library."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleDeleteConfirm();
              }}
              disabled={isDeleting}
              className="bg-[#8e2626] text-white hover:bg-[#7a1f1f] focus-visible:ring-[#8e2626]/40"
            >
              {isDeleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
