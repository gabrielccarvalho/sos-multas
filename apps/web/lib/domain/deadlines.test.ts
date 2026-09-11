import { describe, expect, it } from "vitest"

import {
  computeDeadline,
  daysUntil,
  deadlineUrgency,
  isoDate,
} from "./deadlines"
import { easterSunday, holidaysFor } from "./holidays"

const d = (iso: string) => new Date(`${iso}T00:00:00Z`)

describe("easterSunday", () => {
  it("matches known dates", () => {
    expect(isoDate(easterSunday(2026))).toBe("2026-04-05")
    expect(isoDate(easterSunday(2027))).toBe("2027-03-28")
  })
})

describe("holidaysFor", () => {
  it("includes Good Friday and the national fixed dates", () => {
    const holidays = holidaysFor("OTHER", 2026)
    expect(holidays.has("2026-04-03")).toBe(true)
    expect(holidays.has("2026-10-12")).toBe(true)
    expect(holidays.has("2026-11-20")).toBe(true)
  })

  it("adds the RN holiday for both local órgãos and the Natal holiday only for STTU", () => {
    expect(holidaysFor("DETRAN_RN", 2026).has("2026-10-03")).toBe(true)
    expect(holidaysFor("STTU", 2026).has("2026-10-03")).toBe(true)
    expect(holidaysFor("OTHER", 2026).has("2026-10-03")).toBe(false)
    expect(holidaysFor("STTU", 2026).has("2026-11-21")).toBe(true)
    expect(holidaysFor("DETRAN_RN", 2026).has("2026-11-21")).toBe(false)
  })
})

describe("computeDeadline", () => {
  it("counts consecutive days excluding the notification day", () => {
    expect(isoDate(computeDeadline(d("2026-09-01"), 30, "STTU"))).toBe(
      "2026-10-01"
    )
  })

  it("rolls a Sunday and then a holiday forward to the next business day", () => {
    expect(isoDate(computeDeadline(d("2026-09-11"), 30, "STTU"))).toBe(
      "2026-10-13"
    )
  })

  it("rolls over Good Friday and the weekend after it", () => {
    expect(isoDate(computeDeadline(d("2026-03-04"), 30, "DETRAN_RN"))).toBe(
      "2026-04-06"
    )
  })

  it("applies the Natal municipal holiday only to STTU", () => {
    expect(isoDate(computeDeadline(d("2028-10-22"), 30, "STTU"))).toBe(
      "2028-11-22"
    )
    expect(isoDate(computeDeadline(d("2028-10-22"), 30, "DETRAN_RN"))).toBe(
      "2028-11-21"
    )
  })

  it("applies the RN state holiday to both local órgãos but not to others", () => {
    expect(isoDate(computeDeadline(d("2028-09-03"), 30, "DETRAN_RN"))).toBe(
      "2028-10-04"
    )
    expect(isoDate(computeDeadline(d("2028-09-03"), 30, "OTHER"))).toBe(
      "2028-10-03"
    )
  })
})

describe("daysUntil and deadlineUrgency", () => {
  it("counts whole days between two dates", () => {
    expect(daysUntil(d("2026-09-30"), d("2026-09-11"))).toBe(19)
    expect(daysUntil(d("2026-09-10"), d("2026-09-11"))).toBe(-1)
  })

  it("flags expired, urgent and ok", () => {
    expect(deadlineUrgency(d("2026-09-10"), d("2026-09-11"))).toBe("expired")
    expect(deadlineUrgency(d("2026-09-11"), d("2026-09-11"))).toBe("urgent")
    expect(deadlineUrgency(d("2026-09-16"), d("2026-09-11"))).toBe("urgent")
    expect(deadlineUrgency(d("2026-09-17"), d("2026-09-11"))).toBe("ok")
  })
})
