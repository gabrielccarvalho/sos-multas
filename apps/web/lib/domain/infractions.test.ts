import { describe, expect, it } from "vitest"

import {
  INFRACTIONS,
  amountCents,
  findInfraction,
  normalizeInfractionCode,
  points,
} from "./infractions"

describe("normalizeInfractionCode", () => {
  it("keeps the four-digit code and drops the desdobramento", () => {
    expect(normalizeInfractionCode("7587-0")).toBe("7587")
    expect(normalizeInfractionCode("74550")).toBe("7455")
    expect(normalizeInfractionCode(" 6050 1 ")).toBe("6050")
  })
})

describe("findInfraction", () => {
  it("finds a seeded code in any written form", () => {
    expect(findInfraction("7587-0")?.severity).toBe("gravissima")
    expect(findInfraction("7455")?.ctbArticle).toBe("218, I")
  })

  it("returns undefined for unknown codes", () => {
    expect(findInfraction("0000")).toBeUndefined()
  })
})

describe("amountCents and points", () => {
  it("applies the gravíssima multiplier to the amount but not to the points", () => {
    const speeding = findInfraction("7471")
    expect(speeding).toBeDefined()
    if (!speeding) return
    expect(amountCents(speeding)).toBe(88041)
    expect(points(speeding)).toBe(7)
  })

  it("uses the base amount per severity", () => {
    const media = findInfraction("7455")
    const grave = findInfraction("5185")
    expect(media && amountCents(media)).toBe(13016)
    expect(grave && amountCents(grave)).toBe(19523)
    expect(media && points(media)).toBe(4)
    expect(grave && points(grave)).toBe(5)
  })
})

describe("INFRACTIONS", () => {
  it("has unique four-digit codes", () => {
    const codes = INFRACTIONS.map((infraction) => infraction.code)
    expect(new Set(codes).size).toBe(codes.length)
    for (const code of codes) expect(code).toMatch(/^\d{4}$/)
  })
})
