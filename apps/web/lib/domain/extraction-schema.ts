import { z } from "zod"

const field = <T extends z.ZodType>(schema: T) =>
  z.object({
    value: schema.nullable(),
    confidence: z.number().min(0).max(1),
  })

const isoDate = z.iso.date()
const isoDateTime = z.iso.datetime({ local: true })

export const extractedNotificationSchema = z.object({
  documentTitle: field(z.string()),
  orgaoCode: field(z.string().regex(/^\d{6}$/)),
  orgaoName: field(z.string()),
  aitNumber: field(z.string().min(6).max(12)),
  placa: field(z.string().regex(/^[A-Z]{3}\d[A-Z0-9]\d{2}$/)),
  renavam: field(z.string().regex(/^\d{9,11}$/)),
  infractionCode: field(z.string().regex(/^\d{4}(-?\d)?$/)),
  infractionDescription: field(z.string()),
  occurredAt: field(isoDateTime),
  location: field(z.string()),
  amountCents: field(z.number().int().nonnegative()),
  issuedAt: field(isoDate),
  deadlineDefense: field(isoDate),
  deadlineDriverIndication: field(isoDate),
  deadlineAppeal: field(isoDate),
})

export type ExtractedNotification = z.infer<typeof extractedNotificationSchema>
export type ExtractedField = keyof ExtractedNotification

export const CONFIDENCE_THRESHOLD = 0.8

export function lowConfidenceFields(
  extracted: ExtractedNotification,
  threshold = CONFIDENCE_THRESHOLD
): ExtractedField[] {
  return (Object.keys(extracted) as ExtractedField[]).filter(
    (key) => extracted[key].confidence < threshold
  )
}
