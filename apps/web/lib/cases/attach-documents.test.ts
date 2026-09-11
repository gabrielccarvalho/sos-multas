import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { closeDb } from "../db/client"
import { attachDocuments } from "./attach-documents"
import { getCaseDetails } from "./repository"
import { submitStory } from "./submit-story"
import {
  createConfirmedCase,
  fakeUpload,
  storyForm,
  tempPacketDeps,
} from "./test-helpers"

const documents = () => {
  const data = new FormData()
  data.set("cnh", fakeUpload("cnh.jpg", "image/jpeg"))
  data.set("crlv", fakeUpload("crlv.pdf", "application/pdf"))
  return data
}

describe.skipIf(!process.env.DATABASE_URL)("attachDocuments", () => {
  let deps: Awaited<ReturnType<typeof tempPacketDeps>>

  beforeAll(async () => {
    deps = await tempPacketDeps()
  })

  afterAll(async () => {
    await deps.cleanup()
    await closeDb()
  })

  it("stores the documents and waits for the story", async () => {
    const created = await createConfirmedCase()
    expect(await attachDocuments(created.token, documents(), deps)).toEqual({
      ok: true,
      outcome: "not_ready",
    })
    const details = await getCaseDetails(created.token)
    expect(details?.files.map((file) => file.kind).sort()).toEqual([
      "cnh",
      "crlv",
    ])
    expect(details?.case.status).toBe("needs_documents")
  })

  it("generates the packet once the story and both documents are in", async () => {
    const created = await createConfirmedCase()
    await submitStory(created.token, storyForm({ wasDriving: "nao" }), deps)
    expect(await attachDocuments(created.token, documents(), deps)).toEqual({
      ok: true,
      outcome: "generated",
    })
    const details = await getCaseDetails(created.token)
    expect(details?.case.status).toBe("needs_signature")
    const packet = details?.files.find((file) => file.kind === "packet")
    expect(packet?.originalName).toBe("pacote-AE02024301.pdf")
    const bytes = await deps.storage.get(packet?.storageKey ?? "missing")
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-")
    expect(details?.events.at(-1)?.type).toBe("case.packet_ready")
  })

  it("also generates the packet when the story comes last", async () => {
    const created = await createConfirmedCase()
    await attachDocuments(created.token, documents(), deps)
    await submitStory(created.token, storyForm(), deps)
    const details = await getCaseDetails(created.token)
    expect(details?.case.status).toBe("needs_signature")
  })

  it("rejects a bad file or an empty upload without storing anything", async () => {
    const created = await createConfirmedCase()
    const data = documents()
    data.set("crlv", fakeUpload("crlv.txt", "text/plain"))
    expect(await attachDocuments(created.token, data, deps)).toMatchObject({
      ok: false,
      status: 415,
    })
    expect(
      await attachDocuments(created.token, new FormData(), deps)
    ).toMatchObject({ ok: false, status: 400 })
    expect((await getCaseDetails(created.token))?.files).toEqual([])
  })
})
