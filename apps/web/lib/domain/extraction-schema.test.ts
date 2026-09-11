import { describe, expect, it } from "vitest"

import {
  extractedNotificationSchema,
  lowConfidenceFields,
  type ExtractedNotification,
} from "./extraction-schema"

const fixture = (): ExtractedNotification => ({
  documentTitle: { value: "NOTIFICAÇÃO DA AUTUAÇÃO", confidence: 0.99 },
  orgaoCode: { value: "217610", confidence: 0.95 },
  orgaoName: { value: "STTU - Prefeitura do Natal", confidence: 0.9 },
  aitNumber: { value: "AE02024301", confidence: 0.97 },
  placa: { value: "ABC1D23", confidence: 0.98 },
  renavam: { value: null, confidence: 0 },
  infractionCode: { value: "7587-0", confidence: 0.96 },
  infractionDescription: {
    value: "Avançar o sinal vermelho do semáforo",
    confidence: 0.9,
  },
  occurredAt: { value: "2026-08-01T14:32:00", confidence: 0.93 },
  location: { value: "Av. Prudente de Morais, 1500", confidence: 0.85 },
  amountCents: { value: null, confidence: 0 },
  issuedAt: { value: "2026-08-20", confidence: 0.9 },
  deadlineDefense: { value: "2026-09-21", confidence: 0.92 },
  deadlineDriverIndication: { value: "2026-09-21", confidence: 0.92 },
  deadlineAppeal: { value: null, confidence: 0 },
})

describe("extractedNotificationSchema", () => {
  it("accepts a well-formed extraction", () => {
    expect(extractedNotificationSchema.safeParse(fixture()).success).toBe(true)
  })

  it("accepts both plate formats", () => {
    const old = fixture()
    old.placa.value = "ABC1234"
    expect(extractedNotificationSchema.safeParse(old).success).toBe(true)
  })

  it("rejects a malformed plate", () => {
    const bad = fixture()
    bad.placa.value = "AB-1234"
    expect(extractedNotificationSchema.safeParse(bad).success).toBe(false)
  })

  it("rejects a confidence outside 0..1", () => {
    const bad = fixture()
    bad.placa.confidence = 1.5
    expect(extractedNotificationSchema.safeParse(bad).success).toBe(false)
  })

  it("rejects a date that is not ISO", () => {
    const bad = fixture()
    bad.issuedAt.value = "20/08/2026"
    expect(extractedNotificationSchema.safeParse(bad).success).toBe(false)
  })
})

describe("lowConfidenceFields", () => {
  it("lists the fields below the threshold, including missing ones", () => {
    const extracted = fixture()
    extracted.location.confidence = 0.5
    expect(lowConfidenceFields(extracted)).toEqual([
      "renavam",
      "location",
      "amountCents",
      "deadlineAppeal",
    ])
  })

  it("honours a custom threshold", () => {
    expect(lowConfidenceFields(fixture(), 0.95)).toEqual([
      "orgaoName",
      "renavam",
      "infractionDescription",
      "occurredAt",
      "location",
      "amountCents",
      "issuedAt",
      "deadlineDefense",
      "deadlineDriverIndication",
      "deadlineAppeal",
    ])
  })
})
