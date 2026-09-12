import { getDb, type Database } from "../db/client"
import type { CaseRow } from "../db/schema"
import { formatIsoDate, localIsoDate } from "../documents/format"
import { daysUntil } from "../domain/deadlines"
import type { CaseStatus } from "../domain/status"
import { nextDeadline } from "./next-deadline"
import { addEvent, findEvents, listCases } from "./repository"

export const WARNING_WINDOW_DAYS = 5
export const WARNING_EVENT = "case.deadline_warning"

const QUIET: readonly CaseStatus[] = [
  "filed",
  "under_review",
  "decided_granted",
  "decided_denied",
  "cancelled",
]

export function deadlineIsLive(status: CaseStatus): boolean {
  return !QUIET.includes(status)
}

export interface DeadlineWarning {
  deadline: string
  remainingDays: number
  messagePt: string
}

export function deadlineWarning(
  caseData: Pick<
    CaseRow,
    "status" | "stage" | "deadlineDefense" | "deadlineAppeal"
  >,
  today: Date
): DeadlineWarning | null {
  if (!deadlineIsLive(caseData.status)) return null
  const deadline = nextDeadline(caseData)
  if (!deadline) return null
  const remainingDays = daysUntil(new Date(`${deadline}T00:00:00Z`), today)
  if (remainingDays > WARNING_WINDOW_DAYS) return null
  const what = caseData.stage === "NIP" ? "o recurso" : "a defesa"
  const date = formatIsoDate(deadline)
  const messagePt =
    remainingDays < 0
      ? `O prazo para ${what} venceu em ${date}.`
      : remainingDays === 0
        ? `Atenção: o prazo para ${what} vence hoje (${date}).`
        : remainingDays === 1
          ? `Atenção: o prazo para ${what} vence amanhã (${date}).`
          : `Atenção: o prazo para ${what} vence em ${remainingDays} dias (${date}).`
  return { deadline, remainingDays, messagePt }
}

export async function runDeadlineWarnings(
  now: Date = new Date(),
  db: Database = getDb()
): Promise<number> {
  const today = new Date(`${localIsoDate(now)}T00:00:00Z`)
  let added = 0
  for (const caseData of await listCases({}, db)) {
    const warning = deadlineWarning(caseData, today)
    if (!warning) continue
    const previous = await findEvents(caseData.id, WARNING_EVENT, db)
    const alreadyWarned = previous.some(
      (event) =>
        (event.metadata as { deadline?: string } | null)?.deadline ===
        warning.deadline
    )
    if (alreadyWarned) continue
    await addEvent(
      caseData.id,
      {
        type: WARNING_EVENT,
        messagePt: warning.messagePt,
        actor: "system",
        metadata: { deadline: warning.deadline },
      },
      db
    )
    added++
  }
  return added
}
