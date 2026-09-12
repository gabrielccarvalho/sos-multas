"use server"

import { revalidatePath } from "next/cache"

import { requireOperator } from "@/lib/operator/auth"
import {
  addOperatorNote,
  cancelCase,
  markFiled,
  markUnderReview,
  recordDecision,
  requestCorrection,
  type OperatorResult,
} from "@/lib/operator/case-actions"
import type { FormState } from "@/lib/operator/form-state"

function finish(id: string, result: OperatorResult): FormState {
  revalidatePath(`/admin/casos/${id}`)
  return result.ok
    ? { error: null, done: true }
    : { error: result.error, done: false }
}

const text = (formData: FormData, field: string) =>
  String(formData.get(field) ?? "")

const file = (formData: FormData, field: string) => {
  const value = formData.get(field)
  return value instanceof File ? value : null
}

export async function fileCase(
  id: string,
  _previous: FormState,
  formData: FormData
): Promise<FormState> {
  await requireOperator()
  return finish(
    id,
    await markFiled(id, {
      protocolNumber: text(formData, "protocolNumber"),
      receipt: file(formData, "receipt"),
    })
  )
}

export async function startReview(
  id: string,
  _previous: FormState,
  _formData: FormData
): Promise<FormState> {
  await requireOperator()
  return finish(id, await markUnderReview(id))
}

export async function decide(
  id: string,
  _previous: FormState,
  formData: FormData
): Promise<FormState> {
  await requireOperator()
  return finish(
    id,
    await recordDecision(id, {
      granted: text(formData, "outcome") === "aceita",
      note: text(formData, "note"),
      document: file(formData, "document"),
    })
  )
}

export async function correct(
  id: string,
  _previous: FormState,
  formData: FormData
): Promise<FormState> {
  await requireOperator()
  return finish(id, await requestCorrection(id, text(formData, "message")))
}

export async function note(
  id: string,
  _previous: FormState,
  formData: FormData
): Promise<FormState> {
  await requireOperator()
  return finish(id, await addOperatorNote(id, text(formData, "message")))
}

export async function cancel(
  id: string,
  _previous: FormState,
  formData: FormData
): Promise<FormState> {
  await requireOperator()
  return finish(id, await cancelCase(id, text(formData, "reason")))
}
