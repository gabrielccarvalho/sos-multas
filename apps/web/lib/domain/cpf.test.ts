import { describe, expect, it } from "vitest"

import { formatCpf, isValidCpf, normalizeCpf } from "./cpf"

describe("cpf", () => {
  it("accepts valid CPFs with or without punctuation", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true)
    expect(isValidCpf("11144477735")).toBe(true)
  })

  it("rejects wrong check digits, repeated digits and wrong lengths", () => {
    expect(isValidCpf("529.982.247-24")).toBe(false)
    expect(isValidCpf("111.111.111-11")).toBe(false)
    expect(isValidCpf("123")).toBe(false)
    expect(isValidCpf("")).toBe(false)
  })

  it("normalises and formats", () => {
    expect(normalizeCpf(" 529.982.247-25 ")).toBe("52998224725")
    expect(formatCpf("52998224725")).toBe("529.982.247-25")
  })
})
