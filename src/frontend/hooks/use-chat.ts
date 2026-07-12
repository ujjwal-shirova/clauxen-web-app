"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import type { StreamEvent } from "@/frontend/lib/chat-stream";
import { applyAgentStreamEvent } from "@/frontend/lib/agent-stream-reducer";
import type { Message, RecentChat } from "@/frontend/lib/types";
import { useChatApi } from "@/frontend/hooks/use-chat-api";
import { useAiStream } from "@/frontend/hooks/use-ai-stream";
import {
  getAllChatsNormalized,
  patchAssistantMessage,
  setAllChatsNormalized,
} from "@/frontend/lib/chat-store-bridge";
import {
  migrateLegacyLocalStorage,
  schedulePersistAllChats,
  loadChatMeta,
  loadFullChatFromIndexedDB,
  CHAT_STORAGE_KEY,
  BRANCH_DATASET_KEY,
} from "@/frontend/lib/chat-storage";
import {
  useActiveChatMessages,
  useActiveChatId,
  setActiveChatId,
  useChatStore,
} from "@/frontend/stores/chat-store";
import {
  attachSnapshotToBranchVersion,
  compactMessageBranchData,
  editMessageWithBranchHelper,
  ensureBranchVersions,
  redoUserMessageWithBranchHelper,
  retryAssistantWithBranchHelper,
  switchMessageBranchHelper,
} from "@/frontend/lib/chat-branch";
import { buildChatConversation } from "@/frontend/lib/branch-conversation";
import {
  appendChatTitleAnswerDelta,
  createChatTitleAnswerAccumulator,
  CHAT_TITLE_STREAM_CHAR_MS,
  CHAT_TITLE_STREAM_CHUNK,
  deriveTitleFromExchange,
  extractChatTitleFromText,
  finalizeChatTitleStrippedAnswer,
  normalizeChatTitle,
  stripTitleSourceText,
} from "@/lib/chat-title";
import { sanitizeAssistantStreamDelta } from "@/lib/assistant-output-sanitize";
import { generateChatId } from "@/lib/chat-id";
import {
  canFastAppendAnswer,
  patchToolOutputDelta,
} from "@/frontend/lib/agent-stream-fast-path";
import { agentAnswerDuplicatesInterim } from "@/frontend/lib/agent-frames";
import { createStreamEventBatcher } from "@/frontend/lib/stream-event-batcher";
import { filterStartedRecentChats } from "@/frontend/lib/started-recent-chats";
import type { ChatModelId } from "@/lib/chat-models";
import { DEFAULT_CHAT_MODEL_ID } from "@/lib/chat-models";
import {
  DEFAULT_HOMER_REASONING_EFFORT,
  type HomerReasoningEffort,
} from "@/lib/model-effort";
import { useShallow } from "zustand/react/shallow";

type AllChats = { [key: string]: Message[] };
type BranchDataset = Record<
  string,
  Record<
    string,
    { activeIndex: number; totalVersions: number; updatedAt: number }
  >
>;

/** Shared across useLocalChat instances so streaming survives route changes. */
const sharedGeneration = {
  request: null as AbortController | null,
  context: null as { chatId: string; assistantMessageId: string } | null,
};

function compactChatsForStorage(chats: AllChats): AllChats {
  return Object.fromEntries(
    Object.entries(chats).map(([chatId, messages]) => [
      chatId,
      messages.map(compactMessageBranchData),
    ]),
  );
}

/** URL is authoritative when deep-linking or right after home → /c/{id} navigation. */
function readRouteChatIdFromLocation(): string | null {
  if (typeof window === "undefined") return null;
  return (
    window.location.pathname.match(/\/conversations\/([^/]+)/)?.[1] ??
    window.location.pathname.match(/^\/c\/([^/]+)/)?.[1] ??
    null
  );
}

function isNewChatHomePath(): boolean {
  if (typeof window === "undefined") return false;
  const path = window.location.pathname;
  return path === "/new" || path === "/" || path === "";
}

/**
 * Prefer the URL chat id. On `/` and `/new` always start a blank new chat
 * (ChatGPT/Claude style) — never reopen the previous conversation from IndexedDB.
 */
function preferRouteActiveChatId(restored: string | null): string | null {
  const routeId = readRouteChatIdFromLocation();
  if (routeId) return routeId;
  if (isNewChatHomePath()) return null;
  return restored;
}

/** Only one useLocalChat instance may hydrate — MainLayout + ChatView used to race. */
let localChatHydration: Promise<BranchDataset | undefined> | null = null;

/** In-flight chats win over async IndexedDB hydration (avoids wiping a just-sent turn). */
function mergeWithLiveChats(persisted: AllChats): AllChats {
  const live = useChatStore.getState().exportLegacyAllChats();
  const merged = { ...persisted };
  for (const [chatId, messages] of Object.entries(live)) {
    if (messages.length > 0) merged[chatId] = messages;
  }
  return merged;
}

export type UseChatOptions = {
  apiEnabled?: boolean;
  projectId?: string | null;
  homerReasoningEffort?: HomerReasoningEffort;
  chatModel?: ChatModelId;
};

function useLocalChat(
  options: Pick<
    UseChatOptions,
    "homerReasoningEffort" | "chatModel" | "projectId"
  > = {},
) {
  const homerReasoningEffort =
    options.homerReasoningEffort ?? DEFAULT_HOMER_REASONING_EFFORT;
  const chatModel = options.chatModel ?? DEFAULT_CHAT_MODEL_ID;
  const projectId = options.projectId ?? null;
  const { streamFromResponse } = useAiStream();
  const [branchDataset, setBranchDataset] = useState<BranchDataset>({});
  const recentChats = useChatStore(useShallow((state) => state.recentChats));
  const setRecentChats = useCallback(
    (updater: RecentChat[] | ((prev: RecentChat[]) => RecentChat[])) => {
      useChatStore.getState().setRecentChats(updater);
    },
    [],
  );
  const activeChatId = useActiveChatId();
  const isGenerating = useChatStore((state) => state.isGenerating);
  const setIsGenerating = useCallback((value: boolean) => {
    useChatStore.getState().setIsGenerating(value);
  }, []);
  const setAllChats = setAllChatsNormalized;
  const persistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const allChatsRef = useRef<AllChats>({});
  const recentChatsRef = useRef<RecentChat[]>([]);
  const titleGenerationInProgressRef = useRef<Set<string>>(new Set());

  const messages = useActiveChatMessages();
  const messageIdsByChatId = useChatStore(
    useShallow((state) => state.messageIdsByChatId),
  );
  const activeChat =
    recentChats.find((chat) => chat.id === activeChatId) ?? null;
  const startedRecentChats = useMemo(
    () => filterStartedRecentChats(recentChats, messageIdsByChatId),
    [recentChats, messageIdsByChatId],
  );

  useEffect(() => {
    allChatsRef.current = getAllChatsNormalized();
    return useChatStore.subscribe(() => {
      allChatsRef.current = getAllChatsNormalized();
    });
  }, []);


  useEffect(() => {
    recentChatsRef.current = recentChats;
  }, [recentChats]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!localChatHydration) {
      localChatHydration = (async (): Promise<BranchDataset | undefined> => {
        try {
          const migrated = await migrateLegacyLocalStorage();
          if (migrated) {
            const hydratedChats = Object.fromEntries(
              Object.entries(migrated.allChats).map(([chatId, chatMessages]) => [
                chatId,
                chatMessages.map((message) =>
                  compactMessageBranchData({
                    ...message,
                    isStreaming: false,
                    isThinkingStreaming: false,
                  }),
                ),
              ]),
            );
            const startedMeta = filterStartedRecentChats(
              migrated.meta?.recentChats ?? [],
              hydratedChats,
            );
            const restoredActiveId = preferRouteActiveChatId(
              migrated.meta?.activeChatId &&
              startedMeta.some((chat) => chat.id === migrated.meta?.activeChatId)
                ? migrated.meta.activeChatId
                : (startedMeta[0]?.id ?? null),
            );

            useChatStore.getState().hydrateFromLegacy({
              allChats: mergeWithLiveChats(hydratedChats),
              recentChats: startedMeta,
              activeChatId: restoredActiveId,
              branchDataset: migrated.meta?.branchDataset,
            });
            setActiveChatId(restoredActiveId);
            return migrated.meta?.branchDataset;
          }

          const meta = await loadChatMeta();
          if (!meta) {
            const saved = window.localStorage.getItem(CHAT_STORAGE_KEY);
            if (!saved) {
              const routeChatId = readRouteChatIdFromLocation();
              if (routeChatId) setActiveChatId(routeChatId);
              else if (isNewChatHomePath()) setActiveChatId(null);
              return undefined;
            }
            const parsed = JSON.parse(saved) as {
              allChats?: AllChats;
              recentChats?: RecentChat[];
              activeChatId?: string | null;
              branchDataset?: BranchDataset;
            };
            if (parsed.allChats) {
              const hydratedChats = Object.fromEntries(
                Object.entries(parsed.allChats).map(([chatId, chatMessages]) => [
                  chatId,
                  chatMessages.map((message) =>
                    compactMessageBranchData({
                      ...message,
                      isStreaming: false,
                      isThinkingStreaming: false,
                    }),
                  ),
                ]),
              );
              const startedMeta = filterStartedRecentChats(
                parsed.recentChats ?? [],
                hydratedChats,
              );
              const restoredActiveId = preferRouteActiveChatId(
                parsed.activeChatId &&
                startedMeta.some((chat) => chat.id === parsed.activeChatId)
                  ? parsed.activeChatId
                  : (startedMeta[0]?.id ?? null),
              );

              useChatStore.getState().hydrateFromLegacy({
                allChats: mergeWithLiveChats(hydratedChats),
                recentChats: startedMeta,
                activeChatId: restoredActiveId,
                branchDataset: parsed.branchDataset,
              });
              setActiveChatId(restoredActiveId);
            } else if (parsed.recentChats) {
              const startedMeta = filterStartedRecentChats(
                parsed.recentChats,
                parsed.allChats ?? {},
              );
              useChatStore.getState().setRecentChats(startedMeta);
              setActiveChatId(
                preferRouteActiveChatId(startedMeta[0]?.id ?? null),
              );
            }
            return parsed.branchDataset;
          }

          const allChats: AllChats = {};
          for (const chat of meta.recentChats) {
            const loaded = await loadFullChatFromIndexedDB(chat.id);
            if (loaded.length > 0) {
              allChats[chat.id] = loaded.map((message) =>
                compactMessageBranchData({
                  ...message,
                  isStreaming: false,
                  isThinkingStreaming: false,
                }),
              );
            }
          }

          const startedMeta = filterStartedRecentChats(meta.recentChats, allChats);
          const restoredActiveId = preferRouteActiveChatId(
            meta.activeChatId &&
            startedMeta.some((chat) => chat.id === meta.activeChatId)
              ? meta.activeChatId
              : (startedMeta[0]?.id ?? null),
          );

          setActiveChatId(restoredActiveId);

          useChatStore.getState().hydrateFromLegacy({
            allChats: mergeWithLiveChats(allChats),
            recentChats: startedMeta.map((chat) => ({
              ...chat,
              isTitleStreaming: false,
            })),
            activeChatId: restoredActiveId,
            branchDataset: meta.branchDataset,
          });
          return meta.branchDataset;
        } catch (error) {
          console.error("Failed to restore chat state:", error);
          return undefined;
        }
      })();
    }

    void localChatHydration.then((branchDataset) => {
      if (branchDataset) setBranchDataset(branchDataset);
      // Home must stay on a blank composer even if hydration raced earlier.
      if (isNewChatHomePath() && !readRouteChatIdFromLocation()) {
        setActiveChatId(null);
      }
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let cancelPersist: (() => void) | null = null;

    const schedule = () => {
      cancelPersist?.();
      cancelPersist = schedulePersistAllChats(
        compactChatsForStorage(getAllChatsNormalized()),
        {
          recentChats: recentChatsRef.current,
          activeChatId,
          branchDataset,
        },
        isGenerating ? 900 : 200,
      );
    };

    schedule();
    const unsub = useChatStore.subscribe(schedule);

    return () => {
      unsub();
      cancelPersist?.();
    };
  }, [activeChatId, branchDataset, isGenerating]);

  const finalizeAssistantMessage = useCallback(
    (chatId: string, assistantMessageId: string) => {
      setAllChats((prev) => {
        const currentMessages = prev[chatId] || [];
        return {
          ...prev,
          [chatId]: currentMessages.map((message) =>
            message.id === assistantMessageId
              ? { ...message, isStreaming: false }
              : message,
          ),
        };
      });
    },
    [],
  );

  const finalizeThinkingTimer = useCallback(
    (chatId: string, assistantMessageId: string) => {
      setAllChats((prev) => {
        const currentMessages = prev[chatId] || [];
        return {
          ...prev,
          [chatId]: currentMessages.map((message) => {
            if (message.id !== assistantMessageId) {
              return message;
            }

            if (
              typeof message.thinkingStartedAtMs !== "number" ||
              message.thinkingDurationSeconds !== undefined
            ) {
              return message;
            }

            const durationSeconds = Math.max(
              1,
              Math.round((Date.now() - message.thinkingStartedAtMs) / 1000),
            );
            return {
              ...message,
              thinkingDurationSeconds: durationSeconds,
            };
          }),
        };
      });
    },
    [],
  );

  const stopGeneration = useCallback(() => {
    const activeRequest = sharedGeneration.request;
    const generation = sharedGeneration.context;

    if (!activeRequest || !generation) {
      return;
    }

    activeRequest.abort();
    sharedGeneration.request = null;
    finalizeAssistantMessage(
      generation.chatId,
      generation.assistantMessageId,
    );
    sharedGeneration.context = null;
    setIsGenerating(false);
  }, [finalizeAssistantMessage, setIsGenerating]);

  const streamChatTitle = useCallback(
    async (
      chatId: string,
      nextTitle: string,
      exchange: { userContent: string; assistantContent: string },
    ) => {
      const title = normalizeChatTitle(nextTitle, exchange);

      setRecentChats((prev) => {
        const next = prev.map((chat) =>
          chat.id === chatId ? { ...chat, isTitleStreaming: true } : chat,
        );
        recentChatsRef.current = next;
        return next;
      });

      for (
        let index = CHAT_TITLE_STREAM_CHUNK;
        index <= title.length;
        index += CHAT_TITLE_STREAM_CHUNK
      ) {
        await new Promise((resolve) =>
          setTimeout(resolve, CHAT_TITLE_STREAM_CHAR_MS),
        );
        const partial = title.slice(0, index);
        setRecentChats((prev) => {
          const next = prev.map((chat) =>
            chat.id === chatId
              ? { ...chat, name: partial, isTitleStreaming: true }
              : chat,
          );
          recentChatsRef.current = next;
          return next;
        });
      }

      setRecentChats((prev) => {
        const next = prev.map((chat) =>
          chat.id === chatId
            ? {
                ...chat,
                name: title,
                isTitleStreaming: false,
                titleGenerated: true,
              }
            : chat,
        );
        recentChatsRef.current = next;
        return next;
      });
    },
    [],
  );

  const maybeGenerateChatTitle = useCallback(
    async (
      chatId: string,
      initialExchange?: { userContent: string; assistantContent: string },
    ) => {
      if (titleGenerationInProgressRef.current.has(chatId)) {
        return;
      }

      const chatMeta = recentChatsRef.current.find(
        (chat) => chat.id === chatId,
      );
      if (!chatMeta || chatMeta.titleGenerated) {
        return;
      }

      const chatMessages = allChatsRef.current[chatId] || [];
      const completedAssistants = chatMessages.filter(
        (message) =>
          message.role === "assistant" &&
          !message.isStreaming &&
          message.content.trim().length > 0,
      );
      const firstUserContent =
        initialExchange?.userContent ??
        chatMessages.find(
          (message) =>
            message.role === "user" && message.content.trim().length > 0,
        )?.content;
      const firstAssistantContent =
        initialExchange?.assistantContent ??
        (completedAssistants.length === 1
          ? completedAssistants[0].content
          : undefined);

      if (!firstUserContent?.trim()) {
        return;
      }

      if (!firstAssistantContent?.trim()) {
        return;
      }

      titleGenerationInProgressRef.current.add(chatId);

      const userContentForTitle = stripTitleSourceText(firstUserContent);
      const assistantContentForTitle = stripTitleSourceText(
        firstAssistantContent ?? "",
      );
      const titleMessages = [
        { role: "user", content: userContentForTitle },
        ...(assistantContentForTitle
          ? [{ role: "assistant", content: assistantContentForTitle }]
          : []),
      ];

      try {
        const response = await fetch("/api/chat/title", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: titleMessages,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to generate chat title");
        }

        const payload = (await response.json()) as { title?: string };
        const title = payload.title?.trim() || "";
        await streamChatTitle(chatId, title, {
          userContent: userContentForTitle,
          assistantContent: assistantContentForTitle,
        });
      } catch (error) {
        console.error("Failed to generate chat title:", error);
        const fallback = deriveTitleFromExchange(
          userContentForTitle,
          assistantContentForTitle,
        );
        await streamChatTitle(chatId, fallback, {
          userContent: userContentForTitle,
          assistantContent: assistantContentForTitle,
        });
      } finally {
        titleGenerationInProgressRef.current.delete(chatId);
      }
    },
    [streamChatTitle],
  );

  const startNewChat = useCallback(() => {
    setActiveChatId(null);
    setRecentChats((prev) => {
      const next = filterStartedRecentChats(prev, allChatsRef.current);
      recentChatsRef.current = next;
      return next;
    });
  }, []);

  const streamAssistantResponse = useCallback(
    async ({
      chatId,
      assistantMessageId,
      conversationForApi,
      titleUserContent,
      onCompleted,
    }: {
      chatId: string;
      assistantMessageId: string;
      conversationForApi: Array<{
        role: "user" | "assistant";
        content: string;
      }>;
      titleUserContent?: string;
      onCompleted?: () => void;
    }) => {
      const requestController = new AbortController();
      sharedGeneration.request = requestController;
      sharedGeneration.context = {
        chatId,
        assistantMessageId,
      };
      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages: conversationForApi,
            homerReasoningEffort,
            chatModel,
            conversationId: chatId,
            // Generate the sidebar title after the answer stream so the first
            // tokens are visible immediately instead of hidden title tags.
            generateChatTitle: false,
          }),
          signal: requestController.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error("Failed to generate response");
        }

        let completedAnswer = "";
        let answerStarted = false;
        let streamError: string | null = null;
        const THINK_TAG_REGEX = /<\/?think>/gi;
        const answerAccumulator = titleUserContent
          ? createChatTitleAnswerAccumulator()
          : null;

        const maybeApplyInlineTitle = (_rawTitle: string) => {
          // Sidebar titles are generated after the first assistant response completes.
        };

        const applyAssistantPatch = (
          updater: (message: Message) => Message,
        ) => {
          patchAssistantMessage(chatId, assistantMessageId, updater);
        };

        const handleEventImmediate = (event: StreamEvent) => {
          if (event.type === "chat_title") {
            maybeApplyInlineTitle(event.title);
            return;
          }

          if (event.type === "thinking_delta") {
            if (!event.segmentId && event.delta) {
              useChatStore.getState().patchMessage(
                chatId,
                assistantMessageId,
                (message) => ({
                  ...message,
                  thinkingContent: `${message.thinkingContent ?? ""}${event.delta}`,
                  hasThinking: true,
                  isThinkingStreaming: true,
                  thinkingStartedAtMs: message.thinkingStartedAtMs ?? Date.now(),
                  isStreaming: true,
                }),
              );
              return;
            }

            const sawCloseThinkTag = /<\/think>/i.test(event.delta);
            const normalizedThinkingDelta = event.delta.replace(
              THINK_TAG_REGEX,
              "",
            );
            if (normalizedThinkingDelta || event.segmentId) {
              applyAssistantPatch((message) =>
                applyAgentStreamEvent(message, {
                  ...event,
                  delta: normalizedThinkingDelta,
                }),
              );
            }
            if (sawCloseThinkTag) {
              finalizeThinkingTimer(chatId, assistantMessageId);
              applyAssistantPatch((message) => ({
                ...message,
                isThinkingStreaming: false,
              }));
            }
            return;
          }

          if (event.type === "answer_delta") {
            if (!answerStarted) {
              answerStarted = true;
              finalizeThinkingTimer(chatId, assistantMessageId);
            }

            let visibleDelta = sanitizeAssistantStreamDelta(event.delta);
            if (answerAccumulator) {
              visibleDelta = appendChatTitleAnswerDelta(
                answerAccumulator,
                visibleDelta,
              );
              const extractedTitle = extractChatTitleFromText(
                answerAccumulator.raw,
              );
              if (extractedTitle) {
                maybeApplyInlineTitle(extractedTitle);
              }
              completedAnswer = answerAccumulator.visible;
            } else {
              completedAnswer += event.delta;
            }

            if (!visibleDelta) return;

            const msg = useChatStore.getState().messagesById[assistantMessageId];

            if (canFastAppendAnswer(msg)) {
              useChatStore
                .getState()
                .appendMessageField(chatId, assistantMessageId, "content", visibleDelta);
            } else {
              applyAssistantPatch((message) =>
                applyAgentStreamEvent(message, { ...event, delta: visibleDelta }),
              );
            }
            return;
          }

          if (event.type === "tool_output_delta") {
            applyAssistantPatch((message) => patchToolOutputDelta(message, event));
            return;
          }

          if (event.type === "start") {
            applyAssistantPatch((message) => ({
              ...message,
              agentMode: event.agentMode === true ? true : message.agentMode,
              ...(event.agentMode === true
                ? {
                    agentSegments: [],
                    agentFrames: [],
                    activeAgentFrameIndex: undefined,
                    agentArtifacts: [],
                  }
                : {}),
              agentFrameComplete: false,
              isStreaming: true,
            }));
            return;
          }

          if (event.type === "done") {
            applyAssistantPatch((message) =>
              applyAgentStreamEvent(message, event),
            );
            return;
          }

          if (event.type === "error") {
            streamError = event.message;
            applyAssistantPatch((message) =>
              applyAgentStreamEvent(message, event),
            );
            return;
          }

          applyAssistantPatch((message) =>
            applyAgentStreamEvent(message, event),
          );
        };

        const streamBatcher = createStreamEventBatcher({
          onFlush: (events) => {
            for (const event of events) {
              handleEventImmediate(event);
            }
          },
        });

        const handleEvent = (event: StreamEvent) => {
          if (event.type === "error" || event.type === "done") {
            streamBatcher.flush();
            handleEventImmediate(event);
            return;
          }
          streamBatcher.push(event);
        };

        await streamFromResponse(
          response,
          { onEvent: handleEvent },
          requestController.signal,
        );
        streamBatcher.dispose();

        if (answerAccumulator && answerAccumulator.raw.trim()) {
          const finalized = finalizeChatTitleStrippedAnswer(
            answerAccumulator.raw,
          );
          if (finalized !== answerAccumulator.visible) {
            const trailingDelta = finalized.slice(answerAccumulator.visible.length);
            if (trailingDelta) {
              completedAnswer = finalized;
              applyAssistantPatch((message) =>
                applyAgentStreamEvent(message, {
                  type: "answer_delta",
                  delta: trailingDelta,
                }),
              );
            }
          }
          answerAccumulator.visible = finalized;
          completedAnswer = finalized;
          const extractedTitle = extractChatTitleFromText(answerAccumulator.raw);
          if (extractedTitle) {
            maybeApplyInlineTitle(extractedTitle);
          }
        }

        if (streamError) {
          applyAssistantPatch((message) => ({
            ...message,
            content: message.content || streamError || "Generation failed.",
            isThinkingStreaming: false,
            isStreaming: false,
          }));
          finalizeThinkingTimer(chatId, assistantMessageId);
          sharedGeneration.request = null;
          sharedGeneration.context = null;
          setIsGenerating(false);
          return;
        }

        if (sharedGeneration.request !== requestController) return;

        applyAssistantPatch((message) => {
          const finalizedContent = answerAccumulator
            ? finalizeChatTitleStrippedAnswer(answerAccumulator.raw)
            : finalizeChatTitleStrippedAnswer(message.content);
          const nextContent = agentAnswerDuplicatesInterim({
            ...message,
            content: finalizedContent,
          })
            ? message.content
            : finalizedContent;
          const nextMessage: Message = {
            ...message,
            content: nextContent,
            isThinkingStreaming: false,
            isStreaming: false,
          };
          if (nextMessage.activeBranchIndex !== undefined) {
            const versions = ensureBranchVersions(nextMessage);
            const branchIndex = nextMessage.activeBranchIndex;
            const nextVersions = [...versions];
            nextVersions[branchIndex] = {
              content: nextMessage.content,
              thinkingContent: nextMessage.thinkingContent,
              hasThinking: nextMessage.hasThinking,
              thinkingDurationSeconds: nextMessage.thinkingDurationSeconds,
              agentMode: nextMessage.agentMode,
              agentFrameComplete: nextMessage.agentFrameComplete,
              agentSegments: nextMessage.agentSegments,
              agentFrames: nextMessage.agentFrames,
            };
            nextMessage.branchVersions = nextVersions;
          }
          return nextMessage;
        });
        finalizeThinkingTimer(chatId, assistantMessageId);
        sharedGeneration.request = null;
        sharedGeneration.context = null;
        setIsGenerating(false);
        if (titleUserContent && completedAnswer.trim()) {
          void maybeGenerateChatTitle(chatId, {
            userContent: titleUserContent,
            assistantContent: completedAnswer,
          });
        }
        window.setTimeout(() => onCompleted?.(), 0);
      } catch (error: any) {
        sharedGeneration.request = null;
        const generationContext = sharedGeneration.context;
        sharedGeneration.context = null;

        if (error?.name === "AbortError") {
          if (generationContext) {
            finalizeThinkingTimer(
              generationContext.chatId,
              generationContext.assistantMessageId,
            );
            finalizeAssistantMessage(
              generationContext.chatId,
              generationContext.assistantMessageId,
            );
          }
          setIsGenerating(false);
          return;
        }

        console.error("Error generating response:", error);
        const errorMessage = "Sorry, I encountered an error. Please try again.";
        setAllChats((prev) => {
          const currentMessages = prev[chatId] || [];
          const updatedMessages = currentMessages.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content: errorMessage,
                  thinkingContent: "",
                  isStreaming: false,
                  hasThinking: false,
                }
              : msg,
          );
          return { ...prev, [chatId]: updatedMessages };
        });
        setIsGenerating(false);
      }
    },
    [
      finalizeAssistantMessage,
      finalizeThinkingTimer,
      maybeGenerateChatTitle,
      streamFromResponse,
      homerReasoningEffort,
      chatModel,
    ],
  );

  const handleSendMessage = async (
    prompt: string,
    options?: { forceNewChat?: boolean },
  ): Promise<string | null> => {
    const cleanPrompt = prompt?.trim();
    if (!cleanPrompt || isGenerating) return null;

    setIsGenerating(true);

    let currentChatId = activeChatId;
    const existingMessages = currentChatId
      ? allChatsRef.current[currentChatId] ?? []
      : [];
    const forceNew =
      (options?.forceNewChat ?? false) &&
      currentChatId != null &&
      existingMessages.length > 0;
    const isNewChat =
      !currentChatId || existingMessages.length === 0 || forceNew;

    if (!currentChatId || forceNew) {
      const existingIds = Object.keys(allChatsRef.current);
      currentChatId = generateChatId(existingIds);
      const newChatEntry: RecentChat = {
        id: currentChatId,
        name: "New Chat",
        titleGenerated: false,
        isTitleStreaming: false,
        updatedAt: Date.now(),
        projectId: projectId ?? undefined,
      };

      setAllChats((prev) => ({ ...prev, [currentChatId!]: [] }));
      setRecentChats((prev) => {
        const next = [newChatEntry, ...prev];
        recentChatsRef.current = next;
        return next;
      });
      setActiveChatId(currentChatId);
    } else {
      const chatId = currentChatId;
      setRecentChats((prev) => {
        const current = prev.find((chat) => chat.id === chatId);
        if (!current) {
          const newChatEntry: RecentChat = {
            id: chatId,
            name: "New Chat",
            titleGenerated: false,
            isTitleStreaming: false,
            updatedAt: Date.now(),
            projectId: projectId ?? undefined,
          };
          const next = [newChatEntry, ...prev];
          recentChatsRef.current = next;
          return next;
        }
        const next = [
          { ...current, updatedAt: Date.now() },
          ...prev.filter((chat) => chat.id !== chatId),
        ];
        recentChatsRef.current = next;
        return next;
      });
    }

    const now = Date.now();
    const userMessage: Message = {
      id: now.toString(),
      role: "user",
      content: cleanPrompt,
      createdAt: now,
    };
    const conversationForApi = buildChatConversation([...messages, userMessage]);

    const assistantMessage: Message = {
      id: (now + 1).toString(),
      role: "assistant",
      content: "",
      thinkingContent: "",
      isStreaming: true,
      isThinkingStreaming: false,
      hasThinking: false,
      agentMode: false,
      agentFrameComplete: false,
      createdAt: now + 1,
    };

    setAllChats((prev) => ({
      ...prev,
      [currentChatId!]: [
        ...(prev[currentChatId!] || []),
        userMessage,
        assistantMessage,
      ],
    }));


    void streamAssistantResponse({
      chatId: currentChatId!,
      assistantMessageId: assistantMessage.id,
      conversationForApi,
      titleUserContent: isNewChat ? cleanPrompt : undefined,
    });

    return currentChatId;
  };

  const switchMessageBranch = useCallback(
    (chatId: string, messageId: string, direction: "prev" | "next") => {
      const chatMessages = allChatsRef.current[chatId] || [];
      const { nextChat, nextActiveIndex, totalVersions } =
        switchMessageBranchHelper(chatMessages, messageId, direction);

      setAllChats((prev) => ({
        ...prev,
        [chatId]: nextChat,
      }));
      setBranchDataset((branchPrev) => ({
        ...branchPrev,
        [chatId]: {
          ...(branchPrev[chatId] || {}),
          [messageId]: {
            activeIndex: nextActiveIndex,
            totalVersions,
            updatedAt: Date.now(),
          },
        },
      }));
    },
    [],
  );

  const editMessageWithBranch = useCallback(
    async (chatId: string, messageId: string, newContent: string) => {
      const trimmed = newContent.trim();
      if (!trimmed || isGenerating) return;
      const existing = allChatsRef.current[chatId] || [];

      const assistantMessageId = `${Date.now()}`;
      let helperResult;
      try {
        helperResult = editMessageWithBranchHelper(
          existing,
          messageId,
          trimmed,
          assistantMessageId,
        );
      } catch (err) {
        console.error(err);
        return;
      }

      setIsGenerating(true);

      const { nextChat } = helperResult;
      setAllChats((prev) => ({
        ...prev,
        [chatId]: nextChat,
      }));

      const conversationForApi = buildChatConversation(
        nextChat.slice(0, -1),
      );

      await streamAssistantResponse({
        chatId,
        assistantMessageId,
        conversationForApi,
        onCompleted: () => {
          const finalMessages = allChatsRef.current[chatId] || [];
          setAllChats((prev) => ({
            ...prev,
            [chatId]: attachSnapshotToBranchVersion(finalMessages, messageId),
          }));
          setBranchDataset((prev) => {
            const target = allChatsRef.current[chatId]?.find(
              (m) => m.id === messageId,
            );
            const versionsCount = target
              ? ensureBranchVersions(target).length
              : 1;
            return {
              ...prev,
              [chatId]: {
                ...(prev[chatId] || {}),
                [messageId]: {
                  activeIndex: Math.max(0, versionsCount - 1),
                  totalVersions: versionsCount,
                  updatedAt: Date.now(),
                },
              },
            };
          });
        },
      });
    },
    [isGenerating, streamAssistantResponse],
  );

  const redoUserMessageWithBranch = useCallback(
    async (chatId: string, messageId: string) => {
      if (isGenerating) return;
      const existing = allChatsRef.current[chatId] || [];
      const assistantMessageId = `${Date.now()}`;
      let helperResult;
      try {
        helperResult = redoUserMessageWithBranchHelper(
          existing,
          messageId,
          assistantMessageId,
        );
      } catch (err) {
        console.error(err);
        return;
      }

      setIsGenerating(true);

      const { nextChat } = helperResult;
      setAllChats((prev) => ({
        ...prev,
        [chatId]: nextChat,
      }));

      const conversationForApi = buildChatConversation(
        nextChat.slice(0, -1),
      );

      await streamAssistantResponse({
        chatId,
        assistantMessageId,
        conversationForApi,
        onCompleted: () => {
          const finalMessages = allChatsRef.current[chatId] || [];
          setAllChats((prev) => ({
            ...prev,
            [chatId]: attachSnapshotToBranchVersion(finalMessages, messageId),
          }));
          setBranchDataset((prev) => {
            const target = allChatsRef.current[chatId]?.find(
              (m) => m.id === messageId,
            );
            const versionsCount = target
              ? ensureBranchVersions(target).length
              : 1;
            return {
              ...prev,
              [chatId]: {
                ...(prev[chatId] || {}),
                [messageId]: {
                  activeIndex: Math.max(0, versionsCount - 1),
                  totalVersions: versionsCount,
                  updatedAt: Date.now(),
                },
              },
            };
          });
        },
      });
    },
    [isGenerating, streamAssistantResponse],
  );

  const retryAssistantWithBranch = useCallback(
    async (chatId: string, assistantMessageId: string) => {
      if (isGenerating) return;
      const existing = allChatsRef.current[chatId] || [];

      let helperResult;
      try {
        helperResult = retryAssistantWithBranchHelper(
          existing,
          assistantMessageId,
        );
      } catch (err) {
        console.error(err);
        return;
      }

      setIsGenerating(true);

      const { nextChat } = helperResult;
      setAllChats((prev) => ({
        ...prev,
        [chatId]: nextChat,
      }));

      const conversationForApi = buildChatConversation(
        nextChat.slice(0, -1),
      );

      await streamAssistantResponse({
        chatId,
        assistantMessageId,
        conversationForApi,
        onCompleted: () => {
          const finalMessages = allChatsRef.current[chatId] || [];
          setAllChats((prev) => ({
            ...prev,
            [chatId]: attachSnapshotToBranchVersion(
              finalMessages,
              assistantMessageId,
            ),
          }));
          setBranchDataset((prev) => {
            const target = allChatsRef.current[chatId]?.find(
              (m) => m.id === assistantMessageId,
            );
            const versionsCount = target
              ? ensureBranchVersions(target).length
              : 1;
            return {
              ...prev,
              [chatId]: {
                ...(prev[chatId] || {}),
                [assistantMessageId]: {
                  activeIndex: Math.max(0, versionsCount - 1),
                  totalVersions: versionsCount,
                  updatedAt: Date.now(),
                },
              },
            };
          });
        },
      });
    },
    [isGenerating, streamAssistantResponse],
  );

  const handleSelectChat = useCallback(
    (chatId: string | null) => {
      if (!chatId) {
        startNewChat();
        return;
      }

      setActiveChatId(chatId);

      const store = useChatStore.getState();
      const existingIds = store.messageIdsByChatId[chatId];
      if (existingIds && existingIds.length > 0) return;

      void (async () => {
        try {
          const loaded = await loadFullChatFromIndexedDB(chatId);
          if (loaded.length === 0) return;
          store.setChatMessages(
            chatId,
            loaded.map((message) =>
              compactMessageBranchData({
                ...message,
                isStreaming: false,
                isThinkingStreaming: false,
              }),
            ),
          );
        } catch (error) {
          console.error("Failed to load chat from storage:", error);
        }
      })();
    },
    [startNewChat],
  );

  const handleDeleteChat = useCallback(
    (chatId: string) => {
      setAllChats((prev) => {
        const newChats = { ...prev };
        delete newChats[chatId];
        return newChats;
      });

      const newRecentChats = recentChats.filter((chat) => chat.id !== chatId);
      setRecentChats(newRecentChats);
      setBranchDataset((prev) => {
        const next = { ...prev };
        delete next[chatId];
        return next;
      });

      if (activeChatId === chatId) {
        const started = filterStartedRecentChats(
          newRecentChats,
          allChatsRef.current,
        );
        setActiveChatId(started[0]?.id ?? null);
      }
    },
    [activeChatId, recentChats],
  );

  const handleRenameChat = useCallback((chatId: string, newName: string) => {
    setRecentChats((prev) =>
      prev.map((chat) =>
        chat.id === chatId
          ? { ...chat, name: newName, titleGenerated: true }
          : chat,
      ),
    );
  }, []);

  const handlePinChat = useCallback((chatId: string, pinned: boolean) => {
    setRecentChats((prev) =>
      prev.map((chat) =>
        chat.id === chatId ? { ...chat, pinned } : chat,
      ),
    );
  }, []);

  return {
    messages,
    recentChats,
    startedRecentChats,
    activeChat,
    isGenerating,
    creatingChatPending: false as boolean,
    activeChatId,
    startNewChat,
    handleSendMessage,
    stopGeneration,
    handleSelectChat,
    handleDeleteChat,
    handleRenameChat,
    handlePinChat,
    editMessageWithBranch,
    redoUserMessageWithBranch,
    retryAssistantWithBranch,
    switchMessageBranch,
  };
}

/**
 * IMPORTANT: the api/local branch is locked on the first render of each
 * component instance (ref). Callers must remount with a new `key` when the
 * signed-in user changes — never flip `apiEnabled` on a live instance.
 */
export function useChat(options: UseChatOptions = {}) {
  const modeRef = useRef<"api" | "local" | null>(null);
  if (modeRef.current === null) {
    modeRef.current = options.apiEnabled ? "api" : "local";
  }

  if (modeRef.current === "api") {
    return useChatApi(
      options.projectId ?? null,
      options.chatModel,
      options.homerReasoningEffort,
    );
  }
  return useLocalChat(options);
}
