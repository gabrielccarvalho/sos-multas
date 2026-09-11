import { describe, expect, it } from "vitest"

import { selectArguments, type ArgumentInput } from "./arguments"
import { findInfraction } from "./infractions"

const d = (iso: string) => new Date(`${iso}T00:00:00Z`)

const base: ArgumentInput = {
  stage: "NA",
  occurredAt: d("2026-08-01"),
  notificationIssuedAt: d("2026-08-20"),
  infraction: null,
  answers: {
    wasDriving: true,
    plateMatches: true,
    locationMatches: true,
    signageVisible: true,
  },
}

const keys = (input: ArgumentInput) =>
  selectArguments(input).map((argument) => argument.key)

describe("selectArguments", () => {
  it("selects nothing when every answer is favourable and the NA was on time", () => {
    expect(keys(base)).toEqual([])
  })

  it("flags an NA expedida more than 30 days after the infraction", () => {
    expect(keys({ ...base, notificationIssuedAt: d("2026-09-01") })).toEqual([
      "late_notification",
    ])
    expect(keys({ ...base, notificationIssuedAt: d("2026-08-31") })).toEqual([])
  })

  it("never flags a late NA on a NIP or without an issue date", () => {
    expect(
      keys({ ...base, stage: "NIP", notificationIssuedAt: d("2026-10-01") })
    ).toEqual([])
    expect(keys({ ...base, notificationIssuedAt: null })).toEqual([])
  })

  it("maps each negative answer to its argument", () => {
    expect(
      keys({
        ...base,
        answers: {
          wasDriving: false,
          plateMatches: false,
          locationMatches: false,
          signageVisible: false,
        },
      })
    ).toEqual([
      "not_the_driver",
      "plate_mismatch",
      "location_mismatch",
      "signage_missing",
    ])
  })

  it("ignores unanswered questions", () => {
    expect(
      keys({
        ...base,
        answers: {
          wasDriving: null,
          plateMatches: null,
          locationMatches: null,
          signageVisible: null,
        },
      })
    ).toEqual([])
  })

  it("asks for the equipment certificate on camera infractions", () => {
    expect(
      keys({ ...base, infraction: findInfraction("7455") ?? null })
    ).toEqual(["equipment_certificate"])
    expect(
      keys({ ...base, infraction: findInfraction("5185") ?? null })
    ).toEqual([])
  })

  it("returns pt-BR titles and reasons", () => {
    const [argument] = selectArguments({
      ...base,
      answers: { ...base.answers, wasDriving: false },
    })
    expect(argument?.title).toBe("Indicação do condutor infrator")
    expect(argument?.reason).toContain("não conduzia")
  })
})
