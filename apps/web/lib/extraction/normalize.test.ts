import { describe, expect, it } from "vitest"

import type { ModelOutput } from "./model-output-schema"
import { normalizeExtraction } from "./normalize"

const raw = (): ModelOutput => ({
  documentTitle: { value: "NOTIFICAÇÃO DA AUTUAÇÃO", confidence: 0.99 },
  orgaoCode: { value: "217.610", confidence: 0.9 },
  orgaoName: { value: "STTU", confidence: 0.9 },
  aitNumber: { value: "ae 02024301", confidence: 0.9 },
  placa: { value: "abc-1d23", confidence: 0.9 },
  renavam: { value: "0123.4567.890", confidence: 0.7 },
  infractionCode: { value: "7587 - 0", confidence: 0.9 },
  infractionDescription: { value: "Avançar o sinal", confidence: 0.9 },
  occurredAt: { value: "2026-08-01 14:32:00", confidence: 0.9 },
  location: { value: "Av. Prudente de Morais", confidence: 0.9 },
  amountCents: { value: 29347, confidence: 0.9 },
  issuedAt: { value: "2026-08-20", confidence: 0.9 },
  deadlineDefense: { value: "21/09/2026", confidence: 0.9 },
  deadlineDriverIndication: { value: null, confidence: 0 },
  deadlineAppeal: { value: null, confidence: 1.7 },
})

describe("normalizeExtraction", () => {
  it("cleans up formatting the model kept from the letter", () => {
    const out = normalizeExtraction(raw())
    expect(out.orgaoCode.value).toBe("217610")
    expect(out.aitNumber.value).toBe("AE02024301")
    expect(out.placa.value).toBe("ABC1D23")
    expect(out.renavam.value).toBe("01234567890")
    expect(out.infractionCode.value).toBe("7587-0")
    expect(out.occurredAt.value).toBe("2026-08-01T14:32:00")
  })

  it("drops values that still fail validation instead of throwing", () => {
    const out = normalizeExtraction(raw())
    expect(out.deadlineDefense).toEqual({ value: null, confidence: 0 })
  })

  it("clamps confidence into 0..1", () => {
    const out = normalizeExtraction(raw())
    expect(out.deadlineAppeal.confidence).toBe(1)
    expect(out.documentTitle.confidence).toBe(0.99)
  })

  it("keeps nulls as nulls", () => {
    const out = normalizeExtraction(raw())
    expect(out.deadlineDriverIndication).toEqual({ value: null, confidence: 0 })
  })
})
