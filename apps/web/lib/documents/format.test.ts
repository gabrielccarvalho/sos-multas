import { describe, expect, it } from "vitest"

import {
  formatCep,
  formatDate,
  formatDateLong,
  formatIsoDate,
  formatPhone,
  formatTime,
  localIsoDate,
} from "./format"

describe("format", () => {
  it("formats CEP and phone numbers", () => {
    expect(formatCep("59075000")).toBe("59075-000")
    expect(formatPhone("84999998888")).toBe("(84) 99999-8888")
    expect(formatPhone("8432321234")).toBe("(84) 3232-1234")
    expect(formatPhone("123")).toBe("123")
  })

  it("writes dates in Natal's time zone", () => {
    expect(formatDateLong(new Date("2026-09-11T15:00:00Z"))).toBe(
      "11 de setembro de 2026"
    )
    expect(formatDateLong(new Date("2026-09-12T02:00:00Z"))).toBe(
      "11 de setembro de 2026"
    )
    expect(formatDate(new Date("2026-08-01T17:32:00Z"))).toBe("01/08/2026")
    expect(formatTime(new Date("2026-08-01T17:32:00Z"))).toBe("14:32")
  })

  it("formats ISO dates without time zone arithmetic", () => {
    expect(formatIsoDate("2026-09-21")).toBe("21/09/2026")
  })
})

describe("localIsoDate", () => {
  it("returns the calendar date in Natal", () => {
    expect(localIsoDate(new Date("2026-08-01T17:32:00Z"))).toBe("2026-08-01")
    expect(localIsoDate(new Date("2026-08-02T02:30:00Z"))).toBe("2026-08-01")
  })
})
