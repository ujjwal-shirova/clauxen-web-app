/** Light zinc palette aligned with Clauxen markdown UI */
export const syntaxTheme = {
  plain: "#383a42",
  comment: "#6a737d",
  keyword: "#a62626",
  string: "#50a14f",
  number: "#986801",
  boolean: "#a62626",
  function: "#986801",
  property: "#4078f2",
  variable: "#4078f2",
  type: "#0b7285",
  operator: "#383a42",
  punctuation: "#383a42",
  tag: "#7a1f1f",
  attribute: "#986801",
  builtin: "#0b7285",
  lineNumber: "#a1a1aa",
  selection: "rgba(161, 161, 170, 0.18)",
} as const;

export type SyntaxTokenKind = keyof typeof syntaxTheme;

export function tokenColor(kind: SyntaxTokenKind): string {
  return syntaxTheme[kind];
}
