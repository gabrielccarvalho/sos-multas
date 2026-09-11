import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { closeDb } from "../db/client"
import { createCase, getCaseDetails, transitionCase } from "./repository"
import { submitStory } from "./submit-story"
import { createConfirmedCase, storyForm, tempPacketDeps } from "./test-helpers"

describe.skipIf(!process.env.DATABASE_URL)("submitStory", () => {
  let deps: Awaited<ReturnType<typeof tempPacketDeps>>

  beforeAll(async () => {
    deps = await tempPacketDeps()
  })

  afterAll(async () => {
    await deps.cleanup()
    await closeDb()
  })

  it("saves the owner data and the story and records consent", async () => {
    const created = await createConfirmedCase()
    expect(await submitStory(created.token, storyForm(), deps)).toEqual({
      ok: true,
    })
    const details = await getCaseDetails(created.token)
    expect(details?.case.ownerCpf).toBe("52998224725")
    expect(details?.case.ownerCity).toBe("Natal")
    expect(details?.case.narrative).toEqual({
      answers: {
        wasDriving: true,
        plateMatches: true,
        locationMatches: true,
        signageVisible: false,
      },
      details: "O semáforo estava apagado.",
    })
    const event = details?.events.at(-1)
    expect(event?.type).toBe("case.story_submitted")
    expect(event?.metadata).toEqual({ consentVersion: "2026-09-11" })
    expect(details?.case.status).toBe("needs_documents")
  })

  it("returns field errors and keeps the typed values", async () => {
    const created = await createConfirmedCase()
    const result = await submitStory(
      created.token,
      storyForm({ ownerCpf: "111.111.111-11" }),
      deps
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.state.errors.ownerCpf).toEqual(["CPF inválido."])
    expect(result.state.values?.ownerCpf).toBe("111.111.111-11")
  })

  it("refuses other órgãos, unknown cases and cases at another step", async () => {
    const other = await createConfirmedCase({ orgao: "OTHER" })
    const refused = await submitStory(other.token, storyForm(), deps)
    expect(refused.ok).toBe(false)
    if (!refused.ok) {
      expect(refused.state.message).toContain("STTU e do DETRAN-RN")
    }
    expect((await submitStory("nope", storyForm(), deps)).ok).toBe(false)
    const early = await createCase()
    await transitionCase(early.id, "needs_review", {
      type: "case.extracted",
      messagePt: "Lemos os dados.",
      actor: "system",
    })
    const notYet = await submitStory(early.token, storyForm(), deps)
    expect(notYet.ok).toBe(false)
    if (!notYet.ok) {
      expect(notYet.state.message).toBe("Esta etapa não está disponível agora.")
    }
  })
})
