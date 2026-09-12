import { describe, expect, it } from "vitest"

import { isValidPlaca, normalizePlaca } from "./plate"

describe("plate", () => {
  it("accepts the Mercosul format and the old all-digits format", () => {
    expect(isValidPlaca("ABC1D23")).toBe(true)
    expect(isValidPlaca("ABC1234")).toBe(true)
  })

  it("accepts lowercase input and input with a hyphen or spaces", () => {
    expect(isValidPlaca("abc1d23")).toBe(true)
    expect(isValidPlaca("ABC-1D23")).toBe(true)
    expect(isValidPlaca("ABC 1234")).toBe(true)
  })

  it("rejects a malformed plate", () => {
    expect(isValidPlaca("AB1234")).toBe(false)
    expect(isValidPlaca("ABCD123")).toBe(false)
    expect(isValidPlaca("")).toBe(false)
  })

  it("normalises to uppercase alphanumeric", () => {
    expect(normalizePlaca("abc-1d23")).toBe("ABC1D23")
    expect(normalizePlaca(" abc 1234 ")).toBe("ABC1234")
  })
})
