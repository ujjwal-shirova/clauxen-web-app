"use client";

import React from "react";
import { PromptInput } from "./prompt-input";

export type IsolatedChatInputProps = React.ComponentProps<typeof PromptInput>;

/**
 * Microscopic boundary — typing state never propagates to the message feed tree.
 * Re-renders only when explicit props change (not on every streaming token).
 */
export const IsolatedChatInput = React.memo(function IsolatedChatInput(
  props: IsolatedChatInputProps,
) {
  return <PromptInput {...props} />;
});
