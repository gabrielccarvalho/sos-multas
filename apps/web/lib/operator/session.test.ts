import { describe, expect, it } from "vitest"

import {
  SESSION_MAX_AGE_SECONDS,
  passwordMatches,
  sessionToken,
  verifySession,
} from "./session"

const now = Date.parse("2026-09-11T15:00:00Z")

describe("operator session", () => {
  it("checks the password without leaking length", () => {
    expect(passwordMatches("segredo", "segredo")).toBe(true)
    expect(passwordMatches("segred", "segredo")).toBe(false)
    expect(passwordMatches("segredo", undefined)).toBe(false)
    expect(passwordMatches("", "")).toBe(false)
  })

  it("accepts a fresh token signed with the current password", () => {
    const token = sessionToken("segredo", now - 1000)
    expect(verifySession(token, "segredo", now)).toBe(true)
  })

  it("rejects expired, future, tampered and foreign tokens", () => {
    const expired = sessionToken(
      "segredo",
      now - (SESSION_MAX_AGE_SECONDS + 1) * 1000
    )
    expect(verifySession(expired, "segredo", now)).toBe(false)
    expect(
      verifySession(sessionToken("segredo", now + 60_000), "segredo", now)
    ).toBe(false)
    const token = sessionToken("segredo", now)
    expect(
      verifySession(`${now - 5}.${token.split(".")[1]}`, "segredo", now)
    ).toBe(false)
    expect(verifySession(token, "outra", now)).toBe(false)
    expect(verifySession(undefined, "segredo", now)).toBe(false)
    expect(verifySession(token, undefined, now)).toBe(false)
    expect(verifySession("lixo", "segredo", now)).toBe(false)
  })
})
