const JS_KEYWORDS = new Set([
  "async",
  "await",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "enum",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "from",
  "function",
  "if",
  "import",
  "in",
  "instanceof",
  "interface",
  "let",
  "new",
  "null",
  "of",
  "return",
  "static",
  "super",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "typeof",
  "undefined",
  "var",
  "void",
  "while",
  "with",
  "yield",
  "as",
  "type",
  "implements",
  "private",
  "protected",
  "public",
  "readonly",
  "declare",
  "namespace",
  "module",
  "require",
]);

const PY_KEYWORDS = new Set([
  "and",
  "as",
  "assert",
  "async",
  "await",
  "break",
  "class",
  "continue",
  "def",
  "del",
  "elif",
  "else",
  "except",
  "False",
  "finally",
  "for",
  "from",
  "global",
  "if",
  "import",
  "in",
  "is",
  "lambda",
  "None",
  "nonlocal",
  "not",
  "or",
  "pass",
  "raise",
  "return",
  "True",
  "try",
  "while",
  "with",
  "yield",
]);

const SQL_KEYWORDS = new Set([
  "select",
  "from",
  "where",
  "join",
  "inner",
  "left",
  "right",
  "outer",
  "on",
  "group",
  "by",
  "order",
  "limit",
  "offset",
  "insert",
  "into",
  "values",
  "update",
  "set",
  "delete",
  "create",
  "table",
  "index",
  "and",
  "or",
  "not",
  "null",
  "as",
  "distinct",
  "having",
  "union",
  "all",
  "case",
  "when",
  "then",
  "else",
  "end",
]);

const BASH_KEYWORDS = new Set([
  "if",
  "then",
  "else",
  "elif",
  "fi",
  "for",
  "in",
  "do",
  "done",
  "while",
  "case",
  "esac",
  "function",
  "export",
  "local",
  "return",
  "exit",
  "echo",
  "cd",
  "sudo",
]);

const CSS_KEYWORDS = new Set(["important", "and", "or", "not", "only"]);

const JS_BUILTINS = new Set([
  "console",
  "Math",
  "JSON",
  "Promise",
  "Array",
  "Object",
  "String",
  "Number",
  "Boolean",
  "Date",
  "Map",
  "Set",
  "RegExp",
  "Error",
  "fetch",
  "window",
  "document",
  "process",
  "Buffer",
]);

const PY_BUILTINS = new Set([
  "print",
  "len",
  "range",
  "str",
  "int",
  "float",
  "list",
  "dict",
  "set",
  "tuple",
  "open",
  "type",
  "isinstance",
]);

export const LANGUAGE_ALIASES: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  py: "python",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  yml: "yaml",
  md: "markdown",
  "c++": "cpp",
  h: "c",
  rs: "rust",
  go: "go",
  rb: "ruby",
  kt: "kotlin",
  swift: "swift",
  plaintext: "text",
  text: "text",
  txt: "text",
};

export function normalizeLanguage(language: string): string {
  const raw = language.trim().toLowerCase();
  return LANGUAGE_ALIASES[raw] ?? raw;
}

export function getKeywords(language: string): Set<string> {
  switch (normalizeLanguage(language)) {
    case "javascript":
    case "typescript":
      return JS_KEYWORDS;
    case "python":
      return PY_KEYWORDS;
    case "sql":
      return SQL_KEYWORDS;
    case "bash":
      return BASH_KEYWORDS;
    case "css":
    case "scss":
      return CSS_KEYWORDS;
    case "json":
      return new Set(["true", "false", "null"]);
    case "rust":
      return new Set([
        "fn",
        "let",
        "mut",
        "const",
        "if",
        "else",
        "match",
        "for",
        "while",
        "loop",
        "return",
        "struct",
        "enum",
        "impl",
        "trait",
        "use",
        "pub",
        "mod",
        "async",
        "await",
        "true",
        "false",
        "Self",
        "self",
      ]);
    case "go":
      return new Set([
        "package",
        "import",
        "func",
        "var",
        "const",
        "type",
        "struct",
        "interface",
        "map",
        "chan",
        "if",
        "else",
        "for",
        "range",
        "return",
        "go",
        "defer",
        "switch",
        "case",
        "default",
        "break",
        "continue",
        "true",
        "false",
        "nil",
      ]);
    default:
      return new Set();
  }
}

export function getBuiltins(language: string): Set<string> {
  switch (normalizeLanguage(language)) {
    case "javascript":
    case "typescript":
      return JS_BUILTINS;
    case "python":
      return PY_BUILTINS;
    default:
      return new Set();
  }
}
