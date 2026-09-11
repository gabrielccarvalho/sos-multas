import { z } from "zod"

const stringField = z.object({
  value: z.string().nullable(),
  confidence: z.number(),
})

const numberField = z.object({
  value: z.number().nullable(),
  confidence: z.number(),
})

export const modelOutputSchema = z.object({
  documentTitle: stringField,
  orgaoCode: stringField,
  orgaoName: stringField,
  aitNumber: stringField,
  placa: stringField,
  renavam: stringField,
  infractionCode: stringField,
  infractionDescription: stringField,
  occurredAt: stringField,
  location: stringField,
  amountCents: numberField,
  issuedAt: stringField,
  deadlineDefense: stringField,
  deadlineDriverIndication: stringField,
  deadlineAppeal: stringField,
})

export type ModelOutput = z.infer<typeof modelOutputSchema>
