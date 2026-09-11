import { z } from "zod"

const blankToNull = (value: string) =>
  value.trim() === "" ? null : value.trim()

const optionalText = z.string().default("").transform(blankToNull)

const optionalDate = optionalText.pipe(
  z.iso.date({ error: "Use o formato ano-mês-dia." }).nullable()
)

const amountToCents = (value: string | null): number | null => {
  if (value === null) return null
  const parsed = Number(value.replace(/\./g, "").replace(",", "."))
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : Number.NaN
}

const baseSchema = z.object({
  stage: z.enum(["NA", "NIP"], { error: "Escolha o tipo de notificação." }),
  orgaoCode: optionalText,
  orgaoName: optionalText,
  aitNumber: z
    .string()
    .trim()
    .min(6, "Informe o número do auto de infração.")
    .transform((value) => value.replace(/\s/g, "").toUpperCase()),
  placa: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
    .pipe(z.string().regex(/^[A-Z]{3}\d[A-Z0-9]\d{2}$/, "Placa inválida.")),
  renavam: optionalText.pipe(
    z
      .string()
      .regex(/^\d{9,11}$/, "RENAVAM inválido.")
      .nullable()
  ),
  infractionCode: optionalText,
  infractionDescription: optionalText,
  occurredAt: z
    .string()
    .trim()
    .min(1, "Informe a data e a hora da infração.")
    .transform((value) =>
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? `${value}:00` : value
    )
    .pipe(z.iso.datetime({ local: true, error: "Data e hora inválidas." })),
  location: optionalText,
  amountReais: optionalText
    .transform(amountToCents)
    .pipe(
      z.number({ error: "Valor inválido." }).int().nonnegative().nullable()
    ),
  issuedAt: optionalDate,
  deadlineDefense: optionalDate,
  deadlineDriverIndication: optionalDate,
  deadlineAppeal: optionalDate,
  datesConfirmed: z.literal("on", {
    error: "Confirme as datas antes de continuar.",
  }),
})

export const caseDataFormSchema = baseSchema.transform(
  ({ amountReais, ...rest }) => ({ ...rest, amountCents: amountReais })
)

export type CaseDataForm = z.infer<typeof caseDataFormSchema>
