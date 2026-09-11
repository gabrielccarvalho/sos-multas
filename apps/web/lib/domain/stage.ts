export type Stage = "NA" | "NIP"

export function detectStage(input: {
  documentTitle?: string | null
  hasAmount: boolean
  hasDefenseDeadline: boolean
}): Stage | null {
  const title = input.documentTitle ?? ""
  if (/penalidade/i.test(title)) return "NIP"
  if (/autua[cç][aã]o/i.test(title)) return "NA"
  if (input.hasDefenseDeadline) return "NA"
  if (input.hasAmount) return "NIP"
  return null
}
