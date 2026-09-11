import {
  extractedNotificationSchema,
  type ExtractedField,
  type ExtractedNotification,
} from "../domain/extraction-schema"
import type { ModelOutput } from "./model-output-schema"

const normalizers: Partial<Record<ExtractedField, (value: string) => string>> =
  {
    orgaoCode: (value) => value.replace(/\D/g, ""),
    aitNumber: (value) => value.replace(/\s/g, "").toUpperCase(),
    placa: (value) => value.toUpperCase().replace(/[^A-Z0-9]/g, ""),
    renavam: (value) => value.replace(/\D/g, ""),
    infractionCode: (value) => value.replace(/\s/g, ""),
    occurredAt: (value) => value.trim().replace(" ", "T"),
  }

function clamp(confidence: number): number {
  if (!Number.isFinite(confidence)) return 0
  return Math.min(1, Math.max(0, confidence))
}

export function normalizeExtraction(raw: ModelOutput): ExtractedNotification {
  const shape = extractedNotificationSchema.shape
  const result: Partial<Record<ExtractedField, unknown>> = {}
  for (const key of Object.keys(shape) as ExtractedField[]) {
    const field = raw[key]
    const normalizer = normalizers[key]
    const value =
      typeof field.value === "string" && normalizer
        ? normalizer(field.value)
        : field.value
    const parsed = shape[key].safeParse({
      value,
      confidence: clamp(field.confidence),
    })
    result[key] = parsed.success ? parsed.data : { value: null, confidence: 0 }
  }
  return result as ExtractedNotification
}
