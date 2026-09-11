import { z } from "zod"

import { isValidCpf, normalizeCpf } from "../domain/cpf"

export const CONSENT_VERSION = "2026-09-11"

export const CONSENT_TEXT =
  "Autorizo o uso dos meus dados pessoais, da CNH, do CRLV e da notificação para preparar e protocolar a defesa deste auto de infração junto ao órgão autuador, e declaro que as informações prestadas são verdadeiras. Os documentos são apagados 30 dias após o encerramento do caso."

export const ANSWER_VALUES = ["sim", "nao", "nao_sei"] as const

export type AnswerValue = (typeof ANSWER_VALUES)[number]

export const narrativeSchema = z.object({
  answers: z.object({
    wasDriving: z.boolean().nullable(),
    plateMatches: z.boolean().nullable(),
    locationMatches: z.boolean().nullable(),
    signageVisible: z.boolean().nullable(),
  }),
  details: z.string(),
})

export type Narrative = z.infer<typeof narrativeSchema>

export function answerToValue(answer: boolean | null): AnswerValue {
  if (answer === true) return "sim"
  if (answer === false) return "nao"
  return "nao_sei"
}

const answer = z
  .enum(ANSWER_VALUES, { error: "Escolha uma opção." })
  .transform((value) =>
    value === "sim" ? true : value === "nao" ? false : null
  )

const required = (message: string) =>
  z.string({ error: message }).trim().min(1, message)

const optional = z
  .string()
  .default("")
  .transform((value) => (value.trim() === "" ? null : value.trim()))

const uf = z
  .string({ error: "UF inválida." })
  .trim()
  .toUpperCase()
  .pipe(z.string().regex(/^[A-Z]{2}$/, "UF inválida."))

const digitsOnly = (message: string, pattern: RegExp) =>
  z
    .string({ error: message })
    .transform((value) => value.replace(/\D/g, ""))
    .pipe(z.string().regex(pattern, message))

const baseSchema = z.object({
  wasDriving: answer,
  plateMatches: answer,
  locationMatches: answer,
  signageVisible: answer,
  details: z
    .string()
    .default("")
    .transform((value) => value.trim())
    .pipe(z.string().max(2000, "Use no máximo 2.000 caracteres.")),
  ownerName: required("Informe o nome completo."),
  ownerCpf: z
    .string({ error: "CPF inválido." })
    .transform(normalizeCpf)
    .refine(isValidCpf, "CPF inválido."),
  ownerIdDocument: optional,
  ownerCnhNumber: optional.pipe(
    z
      .string()
      .regex(/^\d{9,11}$/, "Número da CNH inválido.")
      .nullable()
  ),
  ownerEmail: z
    .string({ error: "E-mail inválido." })
    .trim()
    .pipe(z.email({ error: "E-mail inválido." })),
  ownerPhone: digitsOnly("Telefone inválido. Inclua o DDD.", /^\d{10,11}$/),
  ownerAddress: required("Informe o logradouro."),
  ownerAddressNumber: required("Informe o número ou S/N."),
  ownerAddressComplement: optional,
  ownerDistrict: required("Informe o bairro."),
  ownerCity: required("Informe a cidade."),
  ownerState: uf,
  ownerCep: digitsOnly("CEP inválido.", /^\d{8}$/),
  placaUf: uf,
  consent: z.literal("on", {
    error: "Você precisa autorizar para continuar.",
  }),
})

export const storyFormSchema = baseSchema
  .refine(
    (data) => data.ownerIdDocument !== null || data.ownerCnhNumber !== null,
    { error: "Informe o RG ou o número da CNH.", path: ["ownerIdDocument"] }
  )
  .transform((data) => ({
    owner: {
      ownerName: data.ownerName,
      ownerCpf: data.ownerCpf,
      ownerIdDocument: data.ownerIdDocument,
      ownerCnhNumber: data.ownerCnhNumber,
      ownerEmail: data.ownerEmail,
      ownerPhone: data.ownerPhone,
      ownerAddress: data.ownerAddress,
      ownerAddressNumber: data.ownerAddressNumber,
      ownerAddressComplement: data.ownerAddressComplement,
      ownerDistrict: data.ownerDistrict,
      ownerCity: data.ownerCity,
      ownerState: data.ownerState,
      ownerCep: data.ownerCep,
      placaUf: data.placaUf,
    },
    narrative: {
      answers: {
        wasDriving: data.wasDriving,
        plateMatches: data.plateMatches,
        locationMatches: data.locationMatches,
        signageVisible: data.signageVisible,
      },
      details: data.details,
    } satisfies Narrative,
  }))

export type StoryForm = z.infer<typeof storyFormSchema>
