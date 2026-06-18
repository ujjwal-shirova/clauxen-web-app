export type ClarificationResult = {
  status: "waiting_for_user";
  question: string;
};

export function runAskClarification(question: string): ClarificationResult {
  return { status: "waiting_for_user", question };
}
