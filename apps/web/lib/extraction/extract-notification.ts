import Anthropic from "@anthropic-ai/sdk"
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod"

import type { ExtractedNotification } from "../domain/extraction-schema"
import { modelOutputSchema, type ModelOutput } from "./model-output-schema"
import { normalizeExtraction } from "./normalize"
import { EXTRACTION_SYSTEM_PROMPT, PROMPT_VERSION } from "./prompt"

export type NotificationMime = "image/jpeg" | "image/png" | "application/pdf"

export interface NotificationFile {
  bytes: Buffer
  mime: NotificationMime
}

export interface ExtractionResult {
  model: string
  promptVersion: string
  raw: ModelOutput
  extracted: ExtractedNotification
}

type ParseParams = Parameters<Anthropic["messages"]["parse"]>[0]

export interface ExtractionDeps {
  parse(params: ParseParams): Promise<{
    model: string
    stop_reason: string | null
    parsed_output: unknown
  }>
}

export class ExtractionFailedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ExtractionFailedError"
  }
}

export function extractionModel(): string {
  return process.env.EXTRACTION_MODEL ?? "claude-opus-5"
}

export function anthropicDeps(
  client: Anthropic = new Anthropic()
): ExtractionDeps {
  return { parse: (params) => client.messages.parse(params) }
}

function contentFor(file: NotificationFile): Anthropic.ContentBlockParam {
  const data = file.bytes.toString("base64")
  if (file.mime === "application/pdf") {
    return {
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data },
    }
  }
  return {
    type: "image",
    source: { type: "base64", media_type: file.mime, data },
  }
}

export async function extractNotification(
  file: NotificationFile,
  deps: ExtractionDeps = anthropicDeps()
): Promise<ExtractionResult> {
  const response = await deps.parse({
    model: extractionModel(),
    max_tokens: 4096,
    system: EXTRACTION_SYSTEM_PROMPT,
    output_config: {
      format: zodOutputFormat(modelOutputSchema),
      effort: "medium",
    },
    messages: [
      {
        role: "user",
        content: [
          contentFor(file),
          { type: "text", text: "Extract the fields of this notification." },
        ],
      },
    ],
  })

  if (response.stop_reason === "refusal") {
    throw new ExtractionFailedError("the model refused the document")
  }
  const parsed = modelOutputSchema.safeParse(response.parsed_output)
  if (!parsed.success) {
    throw new ExtractionFailedError("the model returned no usable output")
  }
  return {
    model: response.model,
    promptVersion: PROMPT_VERSION,
    raw: parsed.data,
    extracted: normalizeExtraction(parsed.data),
  }
}
