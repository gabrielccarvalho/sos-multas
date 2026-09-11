import { z } from "zod"

import { submittedValues } from "./form-values"
import {
  defaultPacketDeps,
  generatePacketIfReady,
  type PacketDeps,
} from "./generate-packet"
import { addEvent, getCaseByToken, updateCaseData } from "./repository"
import { CONSENT_VERSION, storyFormSchema } from "./story-form-schema"

export interface StoryState {
  errors: Record<string, string[]>
  message: string | null
  values: Record<string, string> | null
}

export type StoryResult = { ok: true } | { ok: false; state: StoryState }

function failure(
  message: string,
  values: Record<string, string>,
  errors: Record<string, string[]> = {}
): StoryResult {
  return { ok: false, state: { errors, message, values } }
}

export async function submitStory(
  token: string,
  formData: FormData,
  deps: PacketDeps = defaultPacketDeps()
): Promise<StoryResult> {
  const values = submittedValues(formData)
  const found = await getCaseByToken(token)
  if (!found) return failure("Caso não encontrado.", values)
  if (found.status !== "needs_documents") {
    return failure("Esta etapa não está disponível agora.", values)
  }
  if (found.orgao === "OTHER") {
    return failure(
      "Por enquanto só preparamos defesas para autos da STTU e do DETRAN-RN.",
      values
    )
  }

  const parsed = storyFormSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return failure(
      "Corrija os campos destacados.",
      values,
      z.flattenError(parsed.error).fieldErrors as Record<string, string[]>
    )
  }

  await updateCaseData(found.id, {
    ...parsed.data.owner,
    narrative: parsed.data.narrative,
  })
  await addEvent(found.id, {
    type: "case.story_submitted",
    messagePt: "Recebemos o seu relato e os seus dados.",
    actor: "user",
    metadata: { consentVersion: CONSENT_VERSION },
  })
  await generatePacketIfReady(token, deps)
  return { ok: true }
}
