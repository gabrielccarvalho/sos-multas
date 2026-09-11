import { describe, expect, it } from "vitest"

import { detectStage } from "./stage"

describe("detectStage", () => {
  it("reads the stage from the document title", () => {
    expect(
      detectStage({
        documentTitle: "NOTIFICAÇÃO DA AUTUAÇÃO",
        hasAmount: true,
        hasDefenseDeadline: false,
      })
    ).toBe("NA")
    expect(
      detectStage({
        documentTitle: "Notificação de Penalidade",
        hasAmount: false,
        hasDefenseDeadline: true,
      })
    ).toBe("NIP")
  })

  it("falls back to the presence of a defense deadline", () => {
    expect(
      detectStage({
        documentTitle: null,
        hasAmount: false,
        hasDefenseDeadline: true,
      })
    ).toBe("NA")
  })

  it("falls back to the presence of an amount", () => {
    expect(
      detectStage({
        documentTitle: "",
        hasAmount: true,
        hasDefenseDeadline: false,
      })
    ).toBe("NIP")
  })

  it("returns null when nothing identifies the stage", () => {
    expect(
      detectStage({
        documentTitle: null,
        hasAmount: false,
        hasDefenseDeadline: false,
      })
    ).toBeNull()
  })
})
