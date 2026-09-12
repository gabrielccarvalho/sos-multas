import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import {
  OPERATOR_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  sessionToken,
  verifySession,
} from "./session"

export async function isOperator(): Promise<boolean> {
  const store = await cookies()
  return verifySession(
    store.get(OPERATOR_COOKIE)?.value,
    process.env.OPERATOR_PASSWORD,
    Date.now()
  )
}

export async function requireOperator(): Promise<void> {
  if (!(await isOperator())) redirect("/admin/entrar")
}

export async function startOperatorSession(): Promise<void> {
  const password = process.env.OPERATOR_PASSWORD
  if (!password) throw new Error("OPERATOR_PASSWORD is not set")
  const store = await cookies()
  store.set(OPERATOR_COOKIE, sessionToken(password, Date.now()), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  })
}

export async function endOperatorSession(): Promise<void> {
  const store = await cookies()
  store.delete(OPERATOR_COOKIE)
}
