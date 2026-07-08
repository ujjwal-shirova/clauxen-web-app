import {
  fileNameFromPath,
  type ChatArtifact,
} from "@/frontend/lib/chat-artifacts";

export type CreateFileBlock = {
  id: string;
  path: string;
  title: string;
  language: string;
  content: string;
  isComplete: boolean;
};

export type ParsedAssistantSegment =
  | { type: "markdown"; content: string }
  | { type: "create_file"; block: CreateFileBlock };

const CREATE_FILE_OPEN_RE = /<create_file(\s[^>]*)?>/gi;
const CREATE_FILE_CLOSE = "</create_file>";
const GENERATED_FOOTER_RE =
  /(?:\r?\n){0,3}(?:[-*_]\s*)?(?:This\s+(?:document|file|code|artifact)\s+was\s+generated\s+by\s+clauxen\s+on\s+[A-Za-z]+\s+\d{1,2},\s+\d{4}\.?|Generated\s+by\s+clauxen\s+on\s+[A-Za-z]+\s+\d{1,2},\s+\d{4}\.?)\s*$/i;

export function parseTagAttributes(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const pattern = /([\w-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(raw)) !== null) {
    attrs[match[1]] = match[3] ?? match[4] ?? "";
  }
  return attrs;
}

export function inferLanguageFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    md: "markdown",
    txt: "text",
    py: "python",
    js: "javascript",
    ts: "typescript",
    tsx: "typescript",
    jsx: "javascript",
    json: "json",
    html: "html",
    css: "css",
    sh: "bash",
    yml: "yaml",
    yaml: "yaml",
    rs: "rust",
    go: "go",
    java: "java",
    cpp: "cpp",
    c: "c",
  };
  return map[ext] ?? (ext || "text");
}

const LANGUAGE_TO_EXTENSION: Record<string, string> = {
  markdown: "md",
  text: "txt",
  plaintext: "txt",
  python: "py",
  javascript: "js",
  typescript: "ts",
  jsx: "jsx",
  tsx: "tsx",
  json: "json",
  html: "html",
  css: "css",
  scss: "scss",
  bash: "sh",
  shell: "sh",
  zsh: "sh",
  yaml: "yaml",
  rust: "rs",
  go: "go",
  java: "java",
  cpp: "cpp",
  c: "c",
  ruby: "rb",
  kotlin: "kt",
  swift: "swift",
  sql: "sql",
  php: "php",
  csharp: "cs",
  c_sharp: "cs",
};

/** Inverse of inferLanguageFromPath — used to name a downloaded code block file. */
export function extensionForLanguage(language: string): string {
  const normalized = language.trim().toLowerCase();
  return LANGUAGE_TO_EXTENSION[normalized] ?? (normalized || "txt");
}

function documentKindLabel(language: string): string {
  const normalized = language.toLowerCase();
  if (normalized === "markdown" || normalized === "md") return "Document";
  if (["python", "javascript", "typescript", "rust", "go", "java", "cpp", "c"].includes(normalized)) {
    return "Code";
  }
  return "File";
}

export function artifactMetaLabel(path: string, language: string): string {
  const ext = path.split(".").pop()?.toUpperCase() ?? language.toUpperCase();
  return `${documentKindLabel(language)} · ${ext}`;
}

/** Only markdown artifacts get a rendered preview; everything else opens in the code viewer. */
export function artifactSupportsPreview(
  path: string,
  language?: string,
): boolean {
  const ext = path.split(".").pop()?.toLowerCase();
  const normalized = language?.toLowerCase();
  return (
    ext === "md" ||
    ext === "markdown" ||
    normalized === "markdown" ||
    normalized === "md"
  );
}

export function stripGeneratedArtifactFooter(content: string): string {
  return content.replace(GENERATED_FOOTER_RE, "").replace(/\s+$/g, "");
}

function buildBlock(
  attrs: Record<string, string>,
  fileContent: string,
  isComplete: boolean,
  fallbackId: string,
): CreateFileBlock {
  const path = attrs.path || attrs.filename || attrs.name || "untitled.txt";
  const title =
    attrs.title ||
    attrs.label ||
    fileNameFromPath(path).replace(/\.[^.]+$/, "") ||
    "Untitled";
  const language = attrs.language || inferLanguageFromPath(path);

  return {
    id: path || fallbackId,
    path,
    title,
    language,
    content: stripGeneratedArtifactFooter(fileContent),
    isComplete,
  };
}

export function parseAssistantContentSegments(
  content: string,
): ParsedAssistantSegment[] {
  if (!content.includes("<create_file")) {
    return content ? [{ type: "markdown", content }] : [];
  }

  const segments: ParsedAssistantSegment[] = [];
  let cursor = 0;
  CREATE_FILE_OPEN_RE.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = CREATE_FILE_OPEN_RE.exec(content)) !== null) {
    const before = content.slice(cursor, match.index);
    if (before.trim()) {
      segments.push({ type: "markdown", content: before });
    }

    const attrs = parseTagAttributes(match[1] ?? "");
    const bodyStart = match.index + match[0].length;
    const rest = content.slice(bodyStart);
    const closeIdx = rest.toLowerCase().indexOf(CREATE_FILE_CLOSE.toLowerCase());

    if (closeIdx >= 0) {
      const fileContent = rest.slice(0, closeIdx);
      segments.push({
        type: "create_file",
        block: buildBlock(attrs, fileContent, true, `file-${match.index}`),
      });
      cursor = bodyStart + closeIdx + CREATE_FILE_CLOSE.length;
      CREATE_FILE_OPEN_RE.lastIndex = cursor;
    } else {
      segments.push({
        type: "create_file",
        block: buildBlock(attrs, rest, false, `file-stream-${match.index}`),
      });
      cursor = content.length;
      break;
    }
  }

  const tail = content.slice(cursor);
  if (tail.trim()) {
    segments.push({ type: "markdown", content: tail });
  }

  return segments;
}

export function collectCreateFileArtifacts(
  content: string,
  messageId: string,
): ChatArtifact[] {
  const segments = parseAssistantContentSegments(content);
  const artifacts: ChatArtifact[] = [];

  for (const segment of segments) {
    if (segment.type !== "create_file" || !segment.block.isComplete) continue;
    const block = segment.block;
    artifacts.push({
      id: `${messageId}:${block.id}`,
      path: block.path,
      fileName: fileNameFromPath(block.path),
      content: block.content,
      language: block.language,
      description: block.title,
      createdAtMs: Date.now(),
    });
  }

  return artifacts;
}

export function mergeChatArtifacts(
  existing: ChatArtifact[] | undefined,
  fromContent: ChatArtifact[],
): ChatArtifact[] {
  const map = new Map<string, ChatArtifact>();
  for (const artifact of existing ?? []) {
    map.set(artifact.id, artifact);
  }
  for (const artifact of fromContent) {
    map.set(artifact.id, artifact);
  }
  return [...map.values()].sort((a, b) => a.createdAtMs - b.createdAtMs);
}

export function stripCreateFileTags(content: string): string {
  return parseAssistantContentSegments(content)
    .filter((segment): segment is Extract<ParsedAssistantSegment, { type: "markdown" }> =>
      segment.type === "markdown",
    )
    .map((segment) => segment.content)
    .join("")
    .trim();
}
