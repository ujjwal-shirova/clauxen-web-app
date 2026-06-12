/// <reference lib="webworker" />

export type SearchIndexEntry = {
  messageId: string;
  chatId: string;
  text: string;
};

export type SearchInbound =
  | { type: "rebuild"; entries: SearchIndexEntry[] }
  | { type: "add"; entry: SearchIndexEntry }
  | { type: "remove"; messageId: string }
  | { type: "query"; query: string; chatId?: string };

export type SearchOutbound = {
  type: "results";
  query: string;
  messageIds: string[];
};

/** Inverted index: lowercase token -> Set of messageIds */
const tokenIndex = new Map<string, Set<string>>();
const entryTexts = new Map<string, string>();
const entryChatIds = new Map<string, string>();

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length >= 2);
}

function indexEntry(entry: SearchIndexEntry) {
  entryTexts.set(entry.messageId, entry.text);
  entryChatIds.set(entry.messageId, entry.chatId);
  for (const token of tokenize(entry.text)) {
    let set = tokenIndex.get(token);
    if (!set) {
      set = new Set();
      tokenIndex.set(token, set);
    }
    set.add(entry.messageId);
  }
}

function removeEntry(messageId: string) {
  const text = entryTexts.get(messageId);
  if (!text) return;
  for (const token of tokenize(text)) {
    const set = tokenIndex.get(token);
    if (set) {
      set.delete(messageId);
      if (set.size === 0) tokenIndex.delete(token);
    }
  }
  entryTexts.delete(messageId);
  entryChatIds.delete(messageId);
}

self.onmessage = (event: MessageEvent<SearchInbound>) => {
  const msg = event.data;

  switch (msg.type) {
    case "rebuild":
      tokenIndex.clear();
      entryTexts.clear();
      entryChatIds.clear();
      for (const entry of msg.entries) indexEntry(entry);
      break;
    case "add":
      removeEntry(msg.entry.messageId);
      indexEntry(msg.entry);
      break;
    case "remove":
      removeEntry(msg.messageId);
      break;
    case "query": {
      const queryTokens = tokenize(msg.query);
      if (queryTokens.length === 0) {
        self.postMessage({
          type: "results",
          query: msg.query,
          messageIds: [],
        } satisfies SearchOutbound);
        return;
      }

      let resultSet: Set<string> | null = null;
      for (const token of queryTokens) {
        const matches = tokenIndex.get(token);
        if (!matches || matches.size === 0) {
          resultSet = new Set();
          break;
        }
        if (resultSet === null) {
          resultSet = new Set(matches);
        } else {
          for (const id of resultSet) {
            if (!matches.has(id)) resultSet.delete(id);
          }
        }
      }

      const ids = [...(resultSet ?? [])];
      const filtered = msg.chatId
        ? ids.filter((id) => entryChatIds.get(id) === msg.chatId)
        : ids;

      self.postMessage({
        type: "results",
        query: msg.query,
        messageIds: filtered,
      } satisfies SearchOutbound);
      break;
    }
  }
};

export {};
