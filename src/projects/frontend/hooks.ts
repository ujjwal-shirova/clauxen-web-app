"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "@/projects/frontend/api";

export function useProjectsList() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: async () => (await api.listProjects()).projects,
  });
}

export function useProject(projectId: string) {
  return useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => (await api.getProject(projectId)).project,
    enabled: Boolean(projectId),
  });
}

export function useProjectFiles(projectId: string) {
  return useQuery({
    queryKey: ["project-files", projectId],
    queryFn: async () => (await api.listProjectFiles(projectId)).files,
    enabled: Boolean(projectId),
    refetchInterval: (query) => {
      const files = query.state.data;
      if (files?.some((f) => f.status === "processing")) return 3000;
      return false;
    },
  });
}

export function useProjectConversations(projectId: string) {
  return useQuery({
    queryKey: ["project-conversations", projectId],
    queryFn: async () => (await api.listConversations(projectId)).conversations,
    enabled: Boolean(projectId),
  });
}

export function useConversationMessages(projectId: string, convId: string) {
  return useQuery({
    queryKey: ["messages", projectId, convId],
    queryFn: async () => (await api.listMessages(projectId, convId)).messages,
    enabled: Boolean(projectId && convId),
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createProject,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useUpdateProject(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: { name?: string; description?: string | null }) =>
      api.updateProject(projectId, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["project", projectId] });
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteProject,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useUpdateInstructions(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (system_prompt: string) =>
      api.updateInstructions(projectId, system_prompt),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", projectId] });
    },
  });
}

export function useCreateConversation(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (title?: string) => api.createConversation(projectId, title),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["project-conversations", projectId],
      });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useUpdateConversation(projectId: string, convId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      patch: Parameters<typeof api.updateConversation>[2],
    ) => api.updateConversation(projectId, convId, patch),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["project-conversations", projectId],
      });
    },
  });
}

export function useDeleteConversation(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (convId: string) => api.deleteConversation(projectId, convId),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["project-conversations", projectId],
      });
    },
  });
}
