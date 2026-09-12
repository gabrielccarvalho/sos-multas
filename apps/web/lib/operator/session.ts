import { createHash, createHmac, timingSafeEqual } from "node:crypto"

export const OPERATOR_COOKIE = "sos_operator"
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12

const digest = (value: string) => createHash("sha256").update(value).digest()

function same(a: string, b: string): boolean {
  return timingSafeEqual(digest(a), digest(b))
}

function signature(password: string, issuedAt: number): string {
  return createHmac("sha256", password)
    .update(`operator:${issuedAt}`)
    .digest("base64url")
}

export function passwordMatches(
  candidate: string,
  password: string | undefined
): boolean {
  if (!password) return false
  return same(candidate, password)
}

export function sessionToken(password: string, issuedAt: number): string {
  return `${issuedAt}.${signature(password, issuedAt)}`
}

export function verifySession(
  token: string | undefined,
  password: string | undefined,
  now: number
): boolean {
  if (!token || !password) return false
  const [issuedPart, signed] = token.split(".")
  const issuedAt = Number(issuedPart)
  if (!signed || !Number.isInteger(issuedAt)) return false
  if (issuedAt > now || now - issuedAt > SESSION_MAX_AGE_SECONDS * 1000) {
    return false
  }
  return same(signed, signature(password, issuedAt))
}
