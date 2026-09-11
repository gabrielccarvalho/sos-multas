import { afterAll, describe, expect, it } from "vitest"

import { closeDb } from "../db/client"
import { InvalidTransitionError } from "../domain/status"
import {
  addEvent,
  addFile,
  createCase,
  getCaseByToken,
  getCaseDetails,
  saveExtraction,
  transitionCase,
  updateCaseData,
} from "./repository"

const event = {
  type: "case.extracted",
  messagePt: "Lemos os dados da notificação.",
  actor: "system" as const,
}

describe.skipIf(!process.env.DATABASE_URL)("case repository", () => {
  afterAll(closeDb)

  it("creates a case with a token and a first event", async () => {
    const created = await createCase()
    expect(created.status).toBe("received")
    expect(created.token).toHaveLength(32)
    const details = await getCaseDetails(created.token)
    expect(details?.events.map((e) => e.type)).toEqual(["case.received"])
    expect(details?.files).toEqual([])
    expect(details?.extraction).toBeNull()
  })

  it("returns null for an unknown token", async () => {
    expect(await getCaseByToken("nope")).toBeNull()
    expect(await getCaseDetails("nope")).toBeNull()
  })

  it("stores files, extractions and confirmed data", async () => {
    const created = await createCase()
    await addFile(created.id, {
      kind: "notification",
      storageKey: `cases/${created.id}/notification.png`,
      mime: "image/png",
      sizeBytes: 1234,
      originalName: "multa.png",
    })
    await saveExtraction(created.id, {
      model: "test-model",
      promptVersion: "test",
      raw: { placa: { value: "ABC1D23", confidence: 0.9 } },
      normalized: { placa: { value: "ABC1D23", confidence: 0.9 } },
    })
    await updateCaseData(created.id, {
      placa: "ABC1D23",
      orgao: "STTU",
      stage: "NA",
      issuedAt: "2026-08-20",
      occurredAt: new Date("2026-08-01T17:32:00Z"),
    })
    const details = await getCaseDetails(created.token)
    expect(details?.files[0]?.kind).toBe("notification")
    expect(details?.extraction?.model).toBe("test-model")
    expect(details?.case.placa).toBe("ABC1D23")
    expect(details?.case.orgao).toBe("STTU")
    expect(details?.case.issuedAt).toBe("2026-08-20")
    expect(details?.case.occurredAt?.toISOString()).toBe(
      "2026-08-01T17:32:00.000Z"
    )
  })

  it("moves status through allowed transitions and records an event", async () => {
    const created = await createCase()
    const moved = await transitionCase(created.id, "needs_review", event)
    expect(moved.status).toBe("needs_review")
    await addEvent(created.id, {
      type: "note",
      messagePt: "Nota do operador.",
      actor: "operator",
      metadata: { by: "test" },
    })
    const details = await getCaseDetails(created.token)
    expect(details?.events.map((e) => e.type)).toEqual([
      "case.received",
      "case.extracted",
      "note",
    ])
  })

  it("rejects an invalid transition without writing anything", async () => {
    const created = await createCase()
    await expect(
      transitionCase(created.id, "filed", event)
    ).rejects.toBeInstanceOf(InvalidTransitionError)
    const details = await getCaseDetails(created.token)
    expect(details?.case.status).toBe("received")
    expect(details?.events).toHaveLength(1)
  })
})
