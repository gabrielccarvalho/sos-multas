"use server"

import { redirect } from "next/navigation"

import { endOperatorSession, startOperatorSession } from "@/lib/operator/auth"
import { passwordMatches } from "@/lib/operator/session"

export async function signIn(
  _previous: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const password = formData.get("password")
  if (
    typeof password !== "string" ||
    !passwordMatches(password, process.env.OPERATOR_PASSWORD)
  ) {
    return { error: "Senha incorreta." }
  }
  await startOperatorSession()
  redirect("/admin")
}

export async function signOut(): Promise<void> {
  await endOperatorSession()
  redirect("/admin/entrar")
}
