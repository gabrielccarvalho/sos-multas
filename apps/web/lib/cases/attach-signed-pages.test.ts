import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { closeDb } from "../db/client"
import { MAX_SIGNED_FILES, attachSignedPages } from "./attach-signed-pages"
import { getCaseDetails, transitionCase } from "./repository"
import { createConfirmedCase, fakeUpload, tempPacketDeps } from "./test-helpers"

async function caseAwaitingSignature() {
  const created = await createConfirmedCase()
  return transitionCase(created.id, "needs_signature", {
    type: "case.packet_ready",
    messagePt: "Pacote pronto.",
    actor: "system",
  })
}

const signed = (...files: File[]) => {
  const data = new FormData()
  for (const file of files) data.append("signed", file)
  return data
}

describe.skipIf(!process.env.DATABASE_URL)("attachSignedPages", () => {
  let deps: Awaited<ReturnType<typeof tempPacketDeps>>

  beforeAll(async () => {
    deps = await tempPacketDeps()
  })

  afterAll(async () => {
    await deps.cleanup()
    await closeDb()
  })

  it("stores every signed page and marks the case ready to file", async () => {
    const awaiting = await caseAwaitingSignature()
    const result = await attachSignedPages(
      awaiting.token,
      signed(fakeUpload("p1.png"), fakeUpload("p2.pdf", "application/pdf")),
      deps
    )
    expect(result).toEqual({ ok: true })
    const details = await getCaseDetails(awaiting.token)
    expect(details?.case.status).toBe("ready_to_file")
    expect(details?.files.map((file) => file.kind)).toEqual([
      "signed_packet",
      "signed_packet",
    ])
    const event = details?.events.at(-1)
    expect(event?.type).toBe("case.signed_received")
    expect(event?.metadata).toEqual({ files: 2 })
  })

  it("rejects empty uploads, too many files and bad formats", async () => {
    const awaiting = await caseAwaitingSignature()
    expect(
      await attachSignedPages(awaiting.token, new FormData(), deps)
    ).toMatchObject({ ok: false, status: 400 })
    const many = Array.from({ length: MAX_SIGNED_FILES + 1 }, (_, index) =>
      fakeUpload(`p${index}.png`)
    )
    expect(
      await attachSignedPages(awaiting.token, signed(...many), deps)
    ).toMatchObject({ ok: false, status: 400 })
    expect(
      await attachSignedPages(
        awaiting.token,
        signed(fakeUpload("p1.png"), fakeUpload("notes.txt", "text/plain")),
        deps
      )
    ).toMatchObject({ ok: false, status: 415 })
    const details = await getCaseDetails(awaiting.token)
    expect(details?.case.status).toBe("needs_signature")
    expect(details?.files).toEqual([])
  })

  it("only accepts signed pages while the case awaits them", async () => {
    const created = await createConfirmedCase()
    expect(
      await attachSignedPages(created.token, signed(fakeUpload("p1.png")), deps)
    ).toMatchObject({ ok: false, status: 409 })
  })
})
