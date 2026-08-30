/** Theme-aware syntax palette aligned with the Clauxen markdown surface. */
export const syntaxTheme = {
  plain: "var(--syntax-plain)",
  comment: "var(--syntax-comment)",
  keyword: "var(--syntax-keyword)",
  string: "var(--syntax-string)",
  number: "var(--syntax-number)",
  boolean: "var(--syntax-number)",
  function: "var(--syntax-function)",
  property: "var(--syntax-property)",
  variable: "var(--syntax-plain)",
  type: "var(--syntax-type)",
  operator: "var(--syntax-operator)",
  punctuation: "var(--syntax-punctuation)",
  tag: "var(--syntax-type)",
  attribute: "var(--syntax-property)",
  builtin: "var(--syntax-function)",
  lineNumber: "var(--syntax-line-number)",
  selection: "var(--syntax-selection)",
} as const;

export type SyntaxTokenKind = keyof typeof syntaxTheme;

export function tokenColor(kind: SyntaxTokenKind): string {
  return syntaxTheme[kind];
}
