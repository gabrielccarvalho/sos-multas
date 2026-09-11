import { describe, expect, it } from "vitest"

import type { CaseFileRow } from "../db/schema"
import { caseProgress } from "./progress"

const narrative = {
  answers: {
    wasDriving: true,
    plateMatches: true,
    locationMatches: true,
    signageVisible: true,
  },
  details: "",
}

const files = (...kinds: CaseFileRow["kind"][]) =>
  kinds.map((kind, index) => ({ kind, id: `file-${index}` }))

describe("caseProgress", () => {
  it("is not ready without the story or the documents", () => {
    const progress = caseProgress({
      case: { ownerName: null, narrative: null },
      files: files("notification", "cnh"),
    })
    expect(progress).toMatchObject({
      hasStory: false,
      hasCnh: true,
      hasCrlv: false,
      readyForPacket: false,
      packet: null,
      signedPages: 0,
    })
  })

  it("is ready with the story, the CNH and the CRLV", () => {
    const progress = caseProgress({
      case: { ownerName: "Maria", narrative },
      files: files("notification", "cnh", "crlv"),
    })
    expect(progress.readyForPacket).toBe(true)
  })

  it("treats an invalid stored narrative as missing", () => {
    const progress = caseProgress({
      case: { ownerName: "Maria", narrative: { foo: 1 } },
      files: files("cnh", "crlv"),
    })
    expect(progress.hasStory).toBe(false)
  })

  it("returns the latest packet and counts the signed pages", () => {
    const progress = caseProgress({
      case: { ownerName: "Maria", narrative },
      files: files("packet", "packet", "signed_packet", "signed_packet"),
    })
    expect(progress.packet?.id).toBe("file-1")
    expect(progress.signedPages).toBe(2)
  })
})
