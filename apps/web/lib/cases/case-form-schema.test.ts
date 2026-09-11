import { describe, expect, it } from "vitest"

import { caseDataFormSchema } from "./case-form-schema"

const valid = {
  stage: "NA",
  orgaoCode: "217610",
  orgaoName: "STTU",
  aitNumber: "ae 02024301",
  placa: "abc-1d23",
  renavam: "",
  infractionCode: "7587-0",
  infractionDescription: "Avançar o sinal vermelho",
  occurredAt: "2026-08-01T14:32",
  location: "Av. Prudente de Morais, 1500",
  amountReais: "",
  issuedAt: "2026-08-20",
  deadlineDefense: "2026-09-21",
  deadlineDriverIndication: "",
  deadlineAppeal: "",
  datesConfirmed: "on",
}

describe("caseDataFormSchema", () => {
  it("normalises text fields and turns blanks into null", () => {
    const parsed = caseDataFormSchema.parse(valid)
    expect(parsed.aitNumber).toBe("AE02024301")
    expect(parsed.placa).toBe("ABC1D23")
    expect(parsed.renavam).toBeNull()
    expect(parsed.deadlineDriverIndication).toBeNull()
    expect(parsed.occurredAt).toBe("2026-08-01T14:32:00")
    expect(parsed.amountCents).toBeNull()
  })

  it("parses amounts written the Brazilian way into cents", () => {
    expect(
      caseDataFormSchema.parse({ ...valid, amountReais: "1.293,47" })
        .amountCents
    ).toBe(129347)
    expect(
      caseDataFormSchema.parse({ ...valid, amountReais: "130,16" }).amountCents
    ).toBe(13016)
  })

  it("requires the dates to be confirmed", () => {
    const result = caseDataFormSchema.safeParse({
      ...valid,
      datesConfirmed: "",
    })
    expect(result.success).toBe(false)
    const missing = caseDataFormSchema.safeParse({
      ...valid,
      datesConfirmed: undefined,
    })
    expect(missing.success).toBe(false)
  })

  it("rejects a bad plate, a bad date and a bad amount with pt-BR messages", () => {
    const result = caseDataFormSchema.safeParse({
      ...valid,
      placa: "AB-1234",
      issuedAt: "20/08/2026",
      amountReais: "abc",
    })
    expect(result.success).toBe(false)
    if (result.success) return
    const messages = result.error.issues.map((issue) => issue.message)
    expect(messages).toContain("Placa inválida.")
    expect(messages).toContain("Use o formato ano-mês-dia.")
    expect(messages).toContain("Valor inválido.")
  })

  it("ignores extra keys such as the $ACTION_ fields", () => {
    const parsed = caseDataFormSchema.parse({ ...valid, $ACTION_ID: "x" })
    expect("$ACTION_ID" in parsed).toBe(false)
  })
})
