/**
 * CustomEvent names used to decouple the global keyboard engine from feature
 * components (composer, sidebar search, code blocks). Components listen for
 * these on `window`; the keyboard controller dispatches them.
 */
export const KS_EVENTS = {
  /** Focus (and lightly reveal) the chat message box. */
  focusComposer: "clx:ks-focus-composer",
  /** Open the chat search dialog. */
  openChatSearch: "clx:ks-open-chat-search",
  /** Ask the sidebar to open its delete confirmation for the active chat. */
  deleteActiveChat: "clx:ks-delete-active-chat",
  /** Open the keyboard shortcuts help dialog. */
  openShortcutsHelp: "clx:ks-open-shortcuts-help",
  /** Copy the most recent code block in the conversation. */
  copyLastCodeBlock: "clx:ks-copy-last-code-block",
} as const;

export type KsEventName = (typeof KS_EVENTS)[keyof typeof KS_EVENTS];
