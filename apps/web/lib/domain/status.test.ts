import { describe, expect, it } from "vitest"

import {
  CASE_STATUSES,
  InvalidTransitionError,
  STATUS_LABELS,
  assertTransition,
  canTransition,
  isTerminal,
} from "./status"

describe("status machine", () => {
  it("walks the happy path in order", () => {
    const path = [
      "received",
      "needs_review",
      "needs_documents",
      "needs_signature",
      "ready_to_file",
      "filed",
      "under_review",
      "decided_granted",
    ] as const
    for (let i = 0; i < path.length - 1; i++) {
      const from = path[i]
      const to = path[i + 1]
      expect(from && to && canTransition(from, to)).toBe(true)
    }
  })

  it("allows the operator to send a case back for corrections", () => {
    expect(canTransition("needs_signature", "needs_documents")).toBe(true)
    expect(canTransition("ready_to_file", "needs_signature")).toBe(true)
  })

  it("allows cancelling any case that has not reached a decision", () => {
    expect(canTransition("received", "cancelled")).toBe(true)
    expect(canTransition("filed", "cancelled")).toBe(true)
    expect(canTransition("under_review", "cancelled")).toBe(true)
  })

  it("rejects skipping steps and leaving terminal states", () => {
    expect(canTransition("received", "filed")).toBe(false)
    expect(canTransition("decided_denied", "under_review")).toBe(false)
    expect(canTransition("cancelled", "received")).toBe(false)
    expect(canTransition("decided_granted", "cancelled")).toBe(false)
  })

  it("throws a typed error on an invalid transition", () => {
    expect(() => assertTransition("received", "filed")).toThrow(
      InvalidTransitionError
    )
    expect(() => assertTransition("received", "needs_review")).not.toThrow()
  })

  it("knows which states are terminal", () => {
    expect(isTerminal("decided_granted")).toBe(true)
    expect(isTerminal("decided_denied")).toBe(true)
    expect(isTerminal("cancelled")).toBe(true)
    expect(isTerminal("filed")).toBe(false)
  })

  it("has a pt-BR label for every status", () => {
    for (const status of CASE_STATUSES) {
      expect(STATUS_LABELS[status].length).toBeGreaterThan(0)
    }
    expect(STATUS_LABELS.filed).toBe("Protocolado")
  })
})
