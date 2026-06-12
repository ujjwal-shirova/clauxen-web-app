import { getBuiltins, getKeywords, normalizeLanguage } from "./languages";
import type { SyntaxTokenKind } from "./theme";

export type HighlightToken = {
  kind: SyntaxTokenKind;
  text: string;
};

type LexState =
  | "code"
  | "string-single"
  | "string-double"
  | "string-template"
  | "comment-line"
  | "comment-block"
  | "comment-hash";

function isIdentStart(ch: string) {
  return /[A-Za-z_$]/.test(ch);
}

function isIdentPart(ch: string) {
  return /[\w$]/.test(ch);
}

function pushToken(
  tokens: HighlightToken[],
  kind: SyntaxTokenKind,
  text: string,
) {
  if (!text) return;
  const last = tokens[tokens.length - 1];
  if (last && last.kind === kind) {
    last.text += text;
    return;
  }
  tokens.push({ kind, text });
}

function classifyIdentifier(
  word: string,
  language: string,
  nextNonSpace: string,
  prevKind: SyntaxTokenKind | null,
  prevText: string | null,
): SyntaxTokenKind {
  const lang = normalizeLanguage(language);
  const keywords = getKeywords(lang);
  const builtins = getBuiltins(lang);

  if (keywords.has(word)) {
    if (
      word === "true" ||
      word === "false" ||
      word === "null" ||
      word === "None" ||
      word === "True" ||
      word === "False"
    ) {
      return "boolean";
    }
    return "keyword";
  }

  if (builtins.has(word)) return "builtin";

  if (nextNonSpace === "(") return "function";

  if (prevText === "." || prevKind === "property") return "property";

  if (lang === "typescript" && /^[A-Z]/.test(word)) return "type";

  return "variable";
}

function tokenizeJson(source: string): HighlightToken[] {
  const tokens: HighlightToken[] = [];
  let i = 0;

  while (i < source.length) {
    const ch = source[i];

    if (/\s/.test(ch)) {
      pushToken(tokens, "plain", ch);
      i += 1;
      continue;
    }

    if (ch === '"') {
      let j = i + 1;
      while (j < source.length) {
        if (source[j] === "\\") {
          j += 2;
          continue;
        }
        if (source[j] === '"') {
          j += 1;
          break;
        }
        j += 1;
      }
      const slice = source.slice(i, j);
      const next = source.slice(j).trimStart();
      pushToken(tokens, next.startsWith(":") ? "property" : "string", slice);
      i = j;
      continue;
    }

    if (/[-0-9]/.test(ch)) {
      let j = i + 1;
      while (j < source.length && /[0-9.eE+-]/.test(source[j])) j += 1;
      pushToken(tokens, "number", source.slice(i, j));
      i = j;
      continue;
    }

    if (/[{}\[\],:]/.test(ch)) {
      pushToken(tokens, "punctuation", ch);
      i += 1;
      continue;
    }

    if (/[a-z]/.test(ch)) {
      let j = i + 1;
      while (j < source.length && /[a-z]/.test(source[j])) j += 1;
      const word = source.slice(i, j);
      pushToken(
        tokens,
        word === "true" || word === "false"
          ? "boolean"
          : word === "null"
            ? "keyword"
            : "plain",
        word,
      );
      i = j;
      continue;
    }

    pushToken(tokens, "plain", ch);
    i += 1;
  }

  return tokens;
}

function tokenizeHtml(source: string): HighlightToken[] {
  const tokens: HighlightToken[] = [];
  let i = 0;
  let state: "text" | "tag" | "attr" = "text";

  while (i < source.length) {
    const ch = source[i];

    if (state === "text") {
      if (ch === "<") {
        pushToken(tokens, "punctuation", "<");
        state = "tag";
        i += 1;
        continue;
      }
      pushToken(tokens, "plain", ch);
      i += 1;
      continue;
    }

    if (state === "tag") {
      if (ch === ">") {
        pushToken(tokens, "punctuation", ">");
        state = "text";
        i += 1;
        continue;
      }
      if (ch === "/") {
        pushToken(tokens, "punctuation", "/");
        i += 1;
        continue;
      }
      if (/\s/.test(ch)) {
        pushToken(tokens, "plain", ch);
        state = "attr";
        i += 1;
        continue;
      }
      let j = i;
      while (j < source.length && /[^\s/>]/.test(source[j])) j += 1;
      pushToken(tokens, "tag", source.slice(i, j));
      i = j;
      continue;
    }

    if (state === "attr") {
      if (ch === ">") {
        pushToken(tokens, "punctuation", ">");
        state = "text";
        i += 1;
        continue;
      }
      if (/\s/.test(ch)) {
        pushToken(tokens, "plain", ch);
        i += 1;
        continue;
      }
      if (ch === "=") {
        pushToken(tokens, "operator", "=");
        i += 1;
        continue;
      }
      if (ch === '"' || ch === "'") {
        const quote = ch;
        let j = i + 1;
        while (j < source.length && source[j] !== quote) {
          if (source[j] === "\\") j += 1;
          j += 1;
        }
        if (j < source.length) j += 1;
        pushToken(tokens, "string", source.slice(i, j));
        i = j;
        continue;
      }
      let j = i;
      while (j < source.length && /[^\s=>]/.test(source[j])) j += 1;
      pushToken(tokens, "attribute", source.slice(i, j));
      i = j;
    }
  }

  return tokens;
}

export function tokenizeCode(
  source: string,
  language: string,
): HighlightToken[] {
  const lang = normalizeLanguage(language);

  if (lang === "json") return tokenizeJson(source);
  if (lang === "html" || lang === "xml" || lang === "markdown") {
    return tokenizeHtml(source);
  }

  const tokens: HighlightToken[] = [];
  let state: LexState = "code";
  let i = 0;
  let prevKind: SyntaxTokenKind | null = null;
  let prevText: string | null = null;
  const commentLine =
    lang === "python" || lang === "bash" || lang === "yaml" ? "#" : "//";
  const usesHashComment = commentLine === "#";

  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1] ?? "";

    if (state === "comment-line") {
      pushToken(tokens, "comment", ch);
      i += 1;
      continue;
    }

    if (state === "comment-hash") {
      pushToken(tokens, "comment", ch);
      i += 1;
      continue;
    }

    if (state === "comment-block") {
      if (ch === "*" && next === "/") {
        pushToken(tokens, "comment", "*/");
        i += 2;
        state = "code";
        continue;
      }
      pushToken(tokens, "comment", ch);
      i += 1;
      continue;
    }

    if (state === "string-single") {
      if (ch === "\\" && next) {
        pushToken(tokens, "string", ch + next);
        i += 2;
        continue;
      }
      pushToken(tokens, "string", ch);
      if (ch === "'") state = "code";
      i += 1;
      continue;
    }

    if (state === "string-double") {
      if (ch === "\\" && next) {
        pushToken(tokens, "string", ch + next);
        i += 2;
        continue;
      }
      pushToken(tokens, "string", ch);
      if (ch === '"') state = "code";
      i += 1;
      continue;
    }

    if (state === "string-template") {
      if (ch === "\\" && next) {
        pushToken(tokens, "string", ch + next);
        i += 2;
        continue;
      }
      if (ch === "`") {
        pushToken(tokens, "string", ch);
        state = "code";
        i += 1;
        continue;
      }
      if (ch === "$" && next === "{") {
        pushToken(tokens, "punctuation", "${");
        i += 2;
        state = "code";
        continue;
      }
      pushToken(tokens, "string", ch);
      i += 1;
      continue;
    }

    if (/\s/.test(ch)) {
      pushToken(tokens, "plain", ch);
      i += 1;
      continue;
    }

    if (usesHashComment && ch === "#" && lang !== "css") {
      state = "comment-hash";
      pushToken(tokens, "comment", ch);
      i += 1;
      continue;
    }

    if (!usesHashComment && ch === "/" && next === "/") {
      state = "comment-line";
      pushToken(tokens, "comment", "//");
      i += 2;
      continue;
    }

    if (!usesHashComment && ch === "/" && next === "*") {
      state = "comment-block";
      pushToken(tokens, "comment", "/*");
      i += 2;
      continue;
    }

    if (ch === "'") {
      state = "string-single";
      pushToken(tokens, "string", ch);
      i += 1;
      continue;
    }

    if (ch === '"') {
      state = "string-double";
      pushToken(tokens, "string", ch);
      i += 1;
      continue;
    }

    if (ch === "`") {
      state = "string-template";
      pushToken(tokens, "string", ch);
      i += 1;
      continue;
    }

    if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(next))) {
      let j = i + 1;
      while (j < source.length && /[0-9_a-fA-F.xXbBoO-]/.test(source[j]))
        j += 1;
      pushToken(tokens, "number", source.slice(i, j));
      i = j;
      prevKind = "number";
      prevText = null;
      continue;
    }

    if (isIdentStart(ch)) {
      let j = i + 1;
      while (j < source.length && isIdentPart(source[j])) j += 1;
      const word = source.slice(i, j);
      let k = j;
      while (k < source.length && /\s/.test(source[k])) k += 1;
      const nextNonSpace = source[k] ?? "";
      const kind = classifyIdentifier(
        word,
        lang,
        nextNonSpace,
        prevKind,
        prevText,
      );
      pushToken(tokens, kind, word);
      prevKind = kind;
      prevText = word;
      i = j;
      continue;
    }

    if (ch === ".") {
      pushToken(tokens, "punctuation", ch);
      prevKind = "punctuation";
      prevText = ".";
      i += 1;
      continue;
    }

    if (/[=<>!+\-*/%&|^~?:]/.test(ch)) {
      let j = i + 1;
      while (j < source.length && /[=<>!+\-*/%&|^~?:]/.test(source[j])) j += 1;
      pushToken(tokens, "operator", source.slice(i, j));
      prevKind = "operator";
      prevText = null;
      i = j;
      continue;
    }

    if (/[{}\[\]();,]/.test(ch)) {
      pushToken(tokens, "punctuation", ch);
      prevKind = "punctuation";
      prevText = ch;
      i += 1;
      continue;
    }

    if (lang === "css" && ch === "#") {
      let j = i + 1;
      while (j < source.length && /[0-9a-fA-F]/.test(source[j])) j += 1;
      pushToken(tokens, "number", source.slice(i, j));
      i = j;
      continue;
    }

    pushToken(tokens, "plain", ch);
    prevKind = "plain";
    prevText = ch;
    i += 1;
  }

  return tokens;
}

export function tokenizeLines(
  source: string,
  language: string,
): HighlightToken[][] {
  const lines = source.split("\n");
  return lines.map((line) => tokenizeCode(line, language));
}
