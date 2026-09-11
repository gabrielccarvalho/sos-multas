import { afterAll, describe, expect, it } from "vitest"

import { closeDb } from "../db/client"
import { confirmCaseData } from "./confirm-case-data"
import { createCase, getCaseDetails, transitionCase } from "./repository"

function form(overrides: Record<string, string> = {}): FormData {
  const data = new FormData()
  const fields: Record<string, string> = {
    stage: "NA",
    orgaoCode: "217610",
    orgaoName: "STTU",
    aitNumber: "AE02024301",
    placa: "abc1d23",
    renavam: "",
    infractionCode: "7587-0",
    infractionDescription: "Avançar o sinal vermelho",
    occurredAt: "2026-08-01T14:32",
    location: "Av. Prudente de Morais, 1500",
    amountReais: "",
    issuedAt: "2026-08-20",
    deadlineDefense: "",
    deadlineDriverIndication: "",
    deadlineAppeal: "",
    datesConfirmed: "on",
    $ACTION_ID_abc: "ignored",
    ...overrides,
  }
  for (const [key, value] of Object.entries(fields)) data.set(key, value)
  return data
}

async function caseInReview() {
  const created = await createCase()
  await transitionCase(created.id, "needs_review", {
    type: "case.extracted",
    messagePt: "Lemos os dados.",
    actor: "system",
  })
  return created
}

describe.skipIf(!process.env.DATABASE_URL)("confirmCaseData", () => {
  afterAll(closeDb)

  it("saves the confirmed data, fills missing NA deadlines and moves on", async () => {
    const created = await caseInReview()
    const result = await confirmCaseData(created.token, form())
    expect(result).toEqual({ ok: true })
    const details = await getCaseDetails(created.token)
    expect(details?.case.status).toBe("needs_documents")
    expect(details?.case.orgao).toBe("STTU")
    expect(details?.case.placa).toBe("ABC1D23")
    expect(details?.case.occurredAt?.toISOString()).toBe(
      "2026-08-01T17:32:00.000Z"
    )
    expect(details?.case.deadlineDefense).toBe("2026-09-21")
    expect(details?.case.deadlineDriverIndication).toBe("2026-09-21")
    expect(details?.events.at(-1)?.type).toBe("case.data_confirmed")
  })

  it("keeps an explicit deadline from the letter", async () => {
    const created = await caseInReview()
    await confirmCaseData(
      created.token,
      form({ deadlineDefense: "2026-09-25" })
    )
    const details = await getCaseDetails(created.token)
    expect(details?.case.deadlineDefense).toBe("2026-09-25")
  })

  it("returns field errors and the submitted values on invalid input", async () => {
    const created = await caseInReview()
    const result = await confirmCaseData(
      created.token,
      form({ placa: "AB-1234", datesConfirmed: "" })
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.state.errors.placa).toEqual(["Placa inválida."])
    expect(result.state.errors.datesConfirmed).toBeDefined()
    expect(result.state.values?.placa).toBe("AB-1234")
    expect(result.state.values?.$ACTION_ID_abc).toBeUndefined()
    const details = await getCaseDetails(created.token)
    expect(details?.case.status).toBe("needs_review")
  })

  it("refuses unknown cases and cases past review", async () => {
    const unknown = await confirmCaseData("nope", form())
    expect(unknown.ok).toBe(false)
    const created = await caseInReview()
    await confirmCaseData(created.token, form())
    const again = await confirmCaseData(created.token, form())
    expect(again.ok).toBe(false)
    if (again.ok) return
    expect(again.state.message).toBe(
      "Os dados deste caso já foram confirmados."
    )
  })
})
