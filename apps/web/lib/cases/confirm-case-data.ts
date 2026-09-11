import { z } from "zod"

import { computeDeadline, isoDate } from "../domain/deadlines"
import { resolveOrgao, type Orgao } from "../domain/orgao"
import { caseDataFormSchema } from "./case-form-schema"
import { submittedValues } from "./form-values"
import { getCaseByToken, transitionCase, updateCaseData } from "./repository"

export interface ConfirmState {
  errors: Record<string, string[]>
  message: string | null
  values: Record<string, string> | null
}

export type ConfirmResult = { ok: true } | { ok: false; state: ConfirmState }

const DEFENSE_DAYS = 30

function fallbackDeadline(
  explicit: string | null,
  from: string | null,
  orgao: Orgao
): string | null {
  if (explicit) return explicit
  if (!from) return null
  return isoDate(
    computeDeadline(new Date(`${from}T00:00:00Z`), DEFENSE_DAYS, orgao)
  )
}

export async function confirmCaseData(
  token: string,
  formData: FormData
): Promise<ConfirmResult> {
  const values = submittedValues(formData)
  const found = await getCaseByToken(token)
  if (!found) {
    return {
      ok: false,
      state: { errors: {}, message: "Caso não encontrado.", values },
    }
  }
  if (found.status !== "needs_review") {
    return {
      ok: false,
      state: {
        errors: {},
        message: "Os dados deste caso já foram confirmados.",
        values,
      },
    }
  }

  const parsed = caseDataFormSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return {
      ok: false,
      state: {
        errors: z.flattenError(parsed.error).fieldErrors as Record<
          string,
          string[]
        >,
        message: "Corrija os campos destacados.",
        values,
      },
    }
  }

  const data = parsed.data
  const orgao = resolveOrgao({ code: data.orgaoCode, name: data.orgaoName })
  const deadlineDefense =
    data.stage === "NA"
      ? fallbackDeadline(data.deadlineDefense, data.issuedAt, orgao)
      : data.deadlineDefense
  const deadlineDriverIndication =
    data.stage === "NA"
      ? fallbackDeadline(data.deadlineDriverIndication, data.issuedAt, orgao)
      : data.deadlineDriverIndication

  await updateCaseData(found.id, {
    orgao,
    stage: data.stage,
    orgaoCode: data.orgaoCode,
    orgaoName: data.orgaoName,
    aitNumber: data.aitNumber,
    placa: data.placa,
    renavam: data.renavam,
    infractionCode: data.infractionCode,
    infractionDescription: data.infractionDescription,
    occurredAt: new Date(`${data.occurredAt}-03:00`),
    location: data.location,
    amountCents: data.amountCents,
    issuedAt: data.issuedAt,
    deadlineDefense,
    deadlineDriverIndication,
    deadlineAppeal: data.deadlineAppeal,
  })
  await transitionCase(found.id, "needs_documents", {
    type: "case.data_confirmed",
    messagePt: "Dados confirmados. Próximo passo: enviar CNH e CRLV.",
    actor: "user",
  })
  return { ok: true }
}
