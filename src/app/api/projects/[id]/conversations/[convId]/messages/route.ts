import { NextRequest } from "next/server";
import { z } from "zod";
import * as projectsRepo from "@/server/repositories/projects.repository";
import * as projectChatsRepo from "@/server/repositories/project-chats.repository";
import {
  retrieveProjectContext,
  buildRagContextBlock,
  assembleSystemPrompt,
} from "@/server/services/project-rag.service";
import { streamOpenAIProjectResponse } from "@/projects/lib/openai";
import { requireProjectsUser, ProjectsAuthError } from "@/projects/lib/auth";
import { jsonData, jsonError } from "@/projects/lib/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string; convId: string }> };

const postSchema = z.object({
  content: z.string().trim().min(1).max(32000),
  model: z.string().optional(),
  thinking_level: z.string().optional(),
});

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireProjectsUser(request);
    const { id, convId } = await context.params;

    const conversation = await projectChatsRepo.getProjectChat(
      convId,
      id,
      user.id,
    );
    if (!conversation) return jsonError("Conversation not found.", 404);

    const messages = await projectChatsRepo.listProjectMessages(convId);
    return jsonData({ messages });
  } catch (error) {
    if (error instanceof ProjectsAuthError) {
      return jsonError(error.message, error.status);
    }
    return jsonError("Internal server error.", 500);
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireProjectsUser(request);
    const { id, convId } = await context.params;

    const project = await projectsRepo.getProject(id, user.id);
    if (!project) return jsonError("Project not found.", 404);

    const conversation = await projectChatsRepo.getProjectChat(
      convId,
      id,
      user.id,
    );
    if (!conversation) return jsonError("Conversation not found.", 404);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid JSON body.", 400);
    }

    const parsed = postSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(
        parsed.error.issues[0]?.message ?? "Validation failed.",
        400,
      );
    }

    await projectChatsRepo.createProjectMessage({
      chatId: convId,
      userId: user.id,
      role: "user",
      content: parsed.data.content,
    });

    const history = await projectChatsRepo.listProjectMessages(convId);

    let ragChunks: Array<{ content: string }> = [];
    try {
      ragChunks = await retrieveProjectContext(
        id,
        user.id,
        parsed.data.content,
      );
    } catch (ragError) {
      console.warn("[rag] retrieval failed:", ragError);
    }

    const ragBlock = buildRagContextBlock(ragChunks);
    const system = assembleSystemPrompt(project.system_prompt, ragBlock);

    const encoder = new TextEncoder();
    let assistantContent = "";

    const stream = new ReadableStream({
      async start(controller) {
        try {
          assistantContent = await streamOpenAIProjectResponse({
            system,
            messages: history.map((m) => ({
              role: m.role as "user" | "assistant",
              content: m.content ?? "",
            })),
            model: parsed.data.model,
            thinkingLevel: parsed.data.thinking_level,
            onToken: (token) => {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ token })}\n\n`),
              );
            },
          });

          await projectChatsRepo.createProjectMessage({
            chatId: convId,
            role: "assistant",
            content: assistantContent,
          });

          if (conversation.title === "New conversation") {
            const title =
              parsed.data.content.slice(0, 48).trim() || "New conversation";
            await projectChatsRepo.updateProjectChat(convId, id, user.id, {
              title,
            });
          } else {
            await projectChatsRepo.touchProjectChat(convId);
          }

          await projectChatsRepo.touchProject(id);

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (streamError) {
          const message =
            streamError instanceof Error
              ? streamError.message
              : "Stream failed.";
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`),
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    if (error instanceof ProjectsAuthError) {
      return jsonError(error.message, error.status);
    }
    console.error("[messages/POST]", error);
    return jsonError("Internal server error.", 500);
  }
}
