import type { CaseRow } from "../db/schema"

export function nextDeadline(
  caseData: Pick<CaseRow, "stage" | "deadlineDefense" | "deadlineAppeal">
): string | null {
  return caseData.stage === "NIP"
    ? caseData.deadlineAppeal
    : caseData.deadlineDefense
}
