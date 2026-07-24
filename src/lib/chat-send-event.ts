export const CLAUXEN_CHAT_SEND_EVENT = "clauxen-chat-send";

export type ChatSendEventDetail = {
  content: string;
  /** Skip the generating queue — used when answering ask_user_input. */
  bypassQueue?: boolean;
};

/** Dispatch a user message into the active chat composer (auto-sends). */
export function dispatchChatSendMessage(
  content: string,
  options?: { bypassQueue?: boolean },
) {
  const trimmed = content.trim();
  if (!trimmed) return;

  window.dispatchEvent(
    new CustomEvent<ChatSendEventDetail>(CLAUXEN_CHAT_SEND_EVENT, {
      detail: {
        content: trimmed,
        bypassQueue: options?.bypassQueue === true,
      },
    }),
  );
}

export function formatAskUserInputReply(
  answers: Array<{ question: string; answer: string }>,
): string {
  const body = answers
    .map(
      ({ question, answer }, i) =>
        `${i + 1}. Q: ${question}\n   A: ${answer}`,
    )
    .join("\n");
  return `[Answers to your questions]\n${body}`;
}
