import { readFile } from "node:fs/promises"

import { describe, expect, it } from "vitest"

import {
  ExtractionFailedError,
  extractNotification,
  type ExtractionDeps,
} from "./extract-notification"
import type { ModelOutput } from "./model-output-schema"
import { PROMPT_VERSION } from "./prompt"

const output: ModelOutput = {
  documentTitle: { value: "NOTIFICAÇÃO DA AUTUAÇÃO", confidence: 0.99 },
  orgaoCode: { value: "217610", confidence: 0.95 },
  orgaoName: { value: "STTU", confidence: 0.9 },
  aitNumber: { value: "AE02024301", confidence: 0.97 },
  placa: { value: "abc1d23", confidence: 0.98 },
  renavam: { value: null, confidence: 0 },
  infractionCode: { value: "7587-0", confidence: 0.96 },
  infractionDescription: { value: "Avançar o sinal vermelho", confidence: 0.9 },
  occurredAt: { value: "2026-08-01T14:32:00", confidence: 0.93 },
  location: { value: "Av. Prudente de Morais, 1500", confidence: 0.85 },
  amountCents: { value: null, confidence: 0 },
  issuedAt: { value: "2026-08-20", confidence: 0.9 },
  deadlineDefense: { value: "2026-09-21", confidence: 0.92 },
  deadlineDriverIndication: { value: "2026-09-21", confidence: 0.92 },
  deadlineAppeal: { value: null, confidence: 0 },
}

function fakeDeps(
  response: Partial<{
    model: string
    stop_reason: string | null
    parsed_output: unknown
  }>
): ExtractionDeps & { calls: unknown[] } {
  const calls: unknown[] = []
  return {
    calls,
    parse: async (params) => {
      calls.push(params)
      return {
        model: "fake-model",
        stop_reason: "end_turn",
        parsed_output: output,
        ...response,
      }
    },
  }
}

const file = { bytes: Buffer.from("png-bytes"), mime: "image/png" as const }

describe("extractNotification", () => {
  it("sends the file and returns the normalised extraction", async () => {
    const deps = fakeDeps({})
    const result = await extractNotification(file, deps)
    expect(result.model).toBe("fake-model")
    expect(result.promptVersion).toBe(PROMPT_VERSION)
    expect(result.extracted.placa.value).toBe("ABC1D23")
    expect(result.raw.placa.value).toBe("abc1d23")
    const params = deps.calls[0] as {
      messages: Array<{ content: Array<{ type: string }> }>
    }
    expect(params.messages[0]?.content[0]?.type).toBe("image")
  })

  it("sends PDFs as document blocks", async () => {
    const deps = fakeDeps({})
    await extractNotification(
      { bytes: Buffer.from("%PDF"), mime: "application/pdf" },
      deps
    )
    const params = deps.calls[0] as {
      messages: Array<{ content: Array<{ type: string }> }>
    }
    expect(params.messages[0]?.content[0]?.type).toBe("document")
  })

  it("fails when the model refuses", async () => {
    await expect(
      extractNotification(file, fakeDeps({ stop_reason: "refusal" }))
    ).rejects.toBeInstanceOf(ExtractionFailedError)
  })

  it("fails when the output does not match the schema", async () => {
    await expect(
      extractNotification(file, fakeDeps({ parsed_output: { nope: true } }))
    ).rejects.toBeInstanceOf(ExtractionFailedError)
    await expect(
      extractNotification(file, fakeDeps({ parsed_output: null }))
    ).rejects.toBeInstanceOf(ExtractionFailedError)
  })
})

describe.skipIf(!process.env.ANTHROPIC_API_KEY)(
  "extractNotification (live)",
  () => {
    it("reads the synthetic STTU letter", async () => {
      const bytes = await readFile(
        new URL("./__fixtures__/na-sttu.png", import.meta.url)
      )
      const { extracted } = await extractNotification({
        bytes,
        mime: "image/png",
      })
      expect(extracted.orgaoCode.value).toBe("217610")
      expect(extracted.aitNumber.value).toBe("AE02024301")
      expect(extracted.placa.value).toBe("ABC1D23")
      expect(extracted.infractionCode.value).toBe("7587-0")
      expect(extracted.deadlineDefense.value).toBe("2026-09-21")
    }, 120_000)
  }
)
