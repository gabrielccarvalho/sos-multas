"use server"

import { redirect } from "next/navigation"

import {
  confirmCaseData as confirm,
  type ConfirmState,
} from "@/lib/cases/confirm-case-data"

export async function confirmCaseData(
  token: string,
  _previous: ConfirmState,
  formData: FormData
): Promise<ConfirmState> {
  const result = await confirm(token, formData)
  if (!result.ok) return result.state
  redirect(`/caso/${token}`)
}
