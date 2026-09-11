import type { CaseFileRow, CaseRow } from "../db/schema"
import { narrativeSchema } from "./story-form-schema"

export interface CaseProgress<F> {
  hasStory: boolean
  hasCnh: boolean
  hasCrlv: boolean
  readyForPacket: boolean
  packet: F | null
  signedPages: number
}

export function caseProgress<F extends Pick<CaseFileRow, "kind">>(input: {
  case: Pick<CaseRow, "ownerName" | "narrative">
  files: F[]
}): CaseProgress<F> {
  const hasStory =
    input.case.ownerName !== null &&
    narrativeSchema.safeParse(input.case.narrative).success
  const has = (kind: CaseFileRow["kind"]) =>
    input.files.some((file) => file.kind === kind)
  const hasCnh = has("cnh")
  const hasCrlv = has("crlv")
  const packets = input.files.filter((file) => file.kind === "packet")
  return {
    hasStory,
    hasCnh,
    hasCrlv,
    readyForPacket: hasStory && hasCnh && hasCrlv,
    packet: packets.at(-1) ?? null,
    signedPages: input.files.filter((file) => file.kind === "signed_packet")
      .length,
  }
}
