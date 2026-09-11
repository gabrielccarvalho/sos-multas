export type Orgao = "STTU" | "DETRAN_RN" | "OTHER"

export const ORGAO_CODES: Record<string, Orgao> = {
  "217610": "STTU",
  "120100": "DETRAN_RN",
}

const NAME_PATTERNS: ReadonlyArray<readonly [RegExp, Orgao]> = [
  [/\bSTTU\b/i, "STTU"],
  [/mobilidade urbana/i, "STTU"],
  [/prefeitura.*natal/i, "STTU"],
  [/detran\s*[-/]?\s*rn\b/i, "DETRAN_RN"],
  [/departamento estadual de tr[âa]nsito/i, "DETRAN_RN"],
]

export function resolveOrgao(input: {
  code?: string | null
  name?: string | null
}): Orgao {
  const code = input.code?.replace(/\D/g, "")
  if (code) {
    const byCode = ORGAO_CODES[code]
    if (byCode) return byCode
  }
  const name = input.name ?? ""
  for (const [pattern, orgao] of NAME_PATTERNS) {
    if (pattern.test(name)) return orgao
  }
  return "OTHER"
}
