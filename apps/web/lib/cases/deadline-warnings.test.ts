import { afterAll, describe, expect, it } from "vitest"

import { closeDb } from "../db/client"
import {
  WARNING_EVENT,
  deadlineWarning,
  runDeadlineWarnings,
} from "./deadline-warnings"
import { findEvents, transitionCase } from "./repository"
import { createConfirmedCase } from "./test-helpers"

const today = new Date("2026-09-11T00:00:00Z")
const open = (deadlineDefense: string | null, stage: "NA" | "NIP" = "NA") => ({
  status: "needs_documents" as const,
  stage,
  deadlineDefense,
  deadlineAppeal: deadlineDefense,
})

describe("deadlineWarning", () => {
  it("stays quiet outside the five-day window and without a deadline", () => {
    expect(deadlineWarning(open("2026-09-17"), today)).toBeNull()
    expect(deadlineWarning(open(null), today)).toBeNull()
  })

  it("writes the right message for each distance", () => {
    expect(deadlineWarning(open("2026-09-16"), today)?.messagePt).toBe(
      "Atenção: o prazo para a defesa vence em 5 dias (16/09/2026)."
    )
    expect(deadlineWarning(open("2026-09-12"), today)?.messagePt).toBe(
      "Atenção: o prazo para a defesa vence amanhã (12/09/2026)."
    )
    expect(deadlineWarning(open("2026-09-11"), today)?.messagePt).toBe(
      "Atenção: o prazo para a defesa vence hoje (11/09/2026)."
    )
    expect(deadlineWarning(open("2026-09-09"), today)?.messagePt).toBe(
      "O prazo para a defesa venceu em 09/09/2026."
    )
    expect(deadlineWarning(open("2026-09-14", "NIP"), today)?.messagePt).toBe(
      "Atenção: o prazo para o recurso vence em 3 dias (14/09/2026)."
    )
  })

  it("ignores cases that were already filed or closed", () => {
    for (const status of [
      "filed",
      "under_review",
      "decided_granted",
      "decided_denied",
      "cancelled",
    ] as const) {
      expect(
        deadlineWarning({ ...open("2026-09-12"), status }, today)
      ).toBeNull()
    }
  })
})

describe.skipIf(!process.env.DATABASE_URL)("runDeadlineWarnings", () => {
  afterAll(closeDb)

  const now = new Date("2026-09-11T12:00:00Z")

  it("warns once per deadline and skips far or filed cases", async () => {
    const soon = await createConfirmedCase({ deadlineDefense: "2026-09-15" })
    const far = await createConfirmedCase({ deadlineDefense: "2026-09-30" })
    const filed = await createConfirmedCase({ deadlineDefense: "2026-09-13" })
    for (const status of [
      "needs_signature",
      "ready_to_file",
      "filed",
    ] as const) {
      await transitionCase(filed.id, status, {
        type: "test.move",
        messagePt: "Movido no teste.",
        actor: "system",
      })
    }

    await runDeadlineWarnings(now)
    await runDeadlineWarnings(now)

    const warnings = await findEvents(soon.id, WARNING_EVENT)
    expect(warnings).toHaveLength(1)
    expect(warnings[0]?.messagePt).toBe(
      "Atenção: o prazo para a defesa vence em 4 dias (15/09/2026)."
    )
    expect(warnings[0]?.metadata).toEqual({ deadline: "2026-09-15" })
    expect(await findEvents(far.id, WARNING_EVENT)).toEqual([])
    expect(await findEvents(filed.id, WARNING_EVENT)).toEqual([])
  })
})
