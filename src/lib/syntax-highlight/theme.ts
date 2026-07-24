/** Light zinc palette aligned with Clauxen markdown UI */
export const syntaxTheme = {
  plain: "#24292f",
  comment: "#6e7781",
  keyword: "#8250df",
  string: "#0a7f42",
  number: "#953800",
  boolean: "#953800",
  function: "#0969da",
  property: "#0550ae",
  variable: "#24292f",
  type: "#116329",
  operator: "#57606a",
  punctuation: "#57606a",
  tag: "#116329",
  attribute: "#0550ae",
  builtin: "#0969da",
  lineNumber: "#a1a1aa",
  selection: "rgba(161, 161, 170, 0.18)",
} as const;

export type SyntaxTokenKind = keyof typeof syntaxTheme;

export function tokenColor(kind: SyntaxTokenKind): string {
  return syntaxTheme[kind];
}
