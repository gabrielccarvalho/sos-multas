import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { getCaseDetailsById, transitionCase } from "../cases/repository"
import {
  createConfirmedCase,
  fakeUpload,
  tempPacketDeps,
} from "../cases/test-helpers"
import { closeDb } from "../db/client"
import type { CaseStatus } from "../domain/status"
import {
  addOperatorNote,
  cancelCase,
  markFiled,
  markUnderReview,
  recordDecision,
  requestCorrection,
} from "./case-actions"

const PATH: CaseStatus[] = ["needs_signature", "ready_to_file", "filed"]

async function caseAt(status: "needs_documents" | CaseStatus) {
  const created = await createConfirmedCase()
  for (const next of PATH) {
    if (status === "needs_documents") break
    await transitionCase(created.id, next, {
      type: "test.move",
      messagePt: "Movido no teste.",
      actor: "system",
    })
    if (next === status) break
  }
  return created
}

const lastEvent = async (id: string) =>
  (await getCaseDetailsById(id))?.events.at(-1)

describe.skipIf(!process.env.DATABASE_URL)("operator case actions", () => {
  let deps: Awaited<ReturnType<typeof tempPacketDeps>>

  beforeAll(async () => {
    deps = await tempPacketDeps()
  })

  afterAll(async () => {
    await deps.cleanup()
    await closeDb()
  })

  it("files a ready case with its protocol number and receipt", async () => {
    const ready = await caseAt("ready_to_file")
    const result = await markFiled(
      ready.id,
      {
        protocolNumber: " 2026/000123 ",
        receipt: fakeUpload("recibo.pdf", "application/pdf"),
      },
      deps
    )
    expect(result).toEqual({ ok: true })
    const details = await getCaseDetailsById(ready.id)
    expect(details?.case.status).toBe("filed")
    expect(details?.case.protocolNumber).toBe("2026/000123")
    expect(details?.case.filedAt?.toISOString()).toBe(deps.now().toISOString())
    expect(details?.files.map((file) => file.kind)).toContain("receipt")
    expect(details?.events.at(-1)?.messagePt).toContain("2026/000123")
  })

  it("files a ready case without a receipt", async () => {
    const ready = await caseAt("ready_to_file")
    const result = await markFiled(
      ready.id,
      { protocolNumber: "2026/000456", receipt: null },
      deps
    )
    expect(result).toEqual({ ok: true })
    const details = await getCaseDetailsById(ready.id)
    expect(details?.case.status).toBe("filed")
    expect(details?.case.protocolNumber).toBe("2026/000456")
    expect(details?.files).toEqual([])
  })

  it("refuses to file without a protocol number, with a bad receipt or from another status", async () => {
    const ready = await caseAt("ready_to_file")
    expect(
      await markFiled(ready.id, { protocolNumber: " ", receipt: null }, deps)
    ).toEqual({ ok: false, error: "Informe o número do protocolo." })
    expect(
      await markFiled(
        ready.id,
        { protocolNumber: "123", receipt: fakeUpload("x.txt", "text/plain") },
        deps
      )
    ).toMatchObject({ ok: false })
    const early = await caseAt("needs_documents")
    expect(
      await markFiled(early.id, { protocolNumber: "123", receipt: null }, deps)
    ).toMatchObject({ ok: false })
    expect((await getCaseDetailsById(ready.id))?.case.status).toBe(
      "ready_to_file"
    )
    expect((await getCaseDetailsById(ready.id))?.files).toEqual([])
  })

  it("moves a filed case to review and records the decision", async () => {
    const filed = await caseAt("filed")
    expect(await markUnderReview(filed.id)).toEqual({ ok: true })
    expect(
      await recordDecision(
        filed.id,
        {
          granted: true,
          note: "Arquivado por falta de aferição.",
          document: fakeUpload("decisao.pdf", "application/pdf"),
        },
        deps
      )
    ).toEqual({ ok: true })
    const details = await getCaseDetailsById(filed.id)
    expect(details?.case.status).toBe("decided_granted")
    expect(details?.files.map((file) => file.kind)).toContain("decision")
    expect(details?.events.at(-1)?.messagePt).toBe(
      "A sua defesa foi aceita. O auto de infração foi arquivado. Arquivado por falta de aferição."
    )
  })

  it("sends a case back for corrections only before filing", async () => {
    const ready = await caseAt("ready_to_file")
    expect(
      await requestCorrection(ready.id, "A assinatura não confere com a CNH.")
    ).toEqual({ ok: true })
    expect((await getCaseDetailsById(ready.id))?.case.status).toBe(
      "needs_signature"
    )
    expect((await lastEvent(ready.id))?.messagePt).toBe(
      "Precisamos de um ajuste: A assinatura não confere com a CNH."
    )
    const filed = await caseAt("filed")
    expect(await requestCorrection(filed.id, "Qualquer coisa.")).toMatchObject({
      ok: false,
    })
    expect(await requestCorrection(ready.id, "  ")).toMatchObject({
      ok: false,
    })
  })

  it("adds notes, rejects oversized text and cancels", async () => {
    const created = await caseAt("needs_documents")
    expect(await addOperatorNote(created.id, "Liguei para a cliente.")).toEqual(
      { ok: true }
    )
    expect((await lastEvent(created.id))?.type).toBe("operator.note")
    expect(await addOperatorNote(created.id, "x".repeat(1001))).toEqual({
      ok: false,
      error: "Use no máximo 1.000 caracteres.",
    })
    expect(await cancelCase(created.id, "Cliente desistiu.")).toEqual({
      ok: true,
    })
    expect((await getCaseDetailsById(created.id))?.case.status).toBe(
      "cancelled"
    )
  })

  it("answers not found for unknown ids", async () => {
    expect(await markUnderReview("nope")).toEqual({
      ok: false,
      error: "Caso não encontrado.",
    })
  })
})
