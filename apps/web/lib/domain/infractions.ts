export type Severity = "leve" | "media" | "grave" | "gravissima"

export const SEVERITY_POINTS: Record<Severity, number> = {
  leve: 3,
  media: 4,
  grave: 5,
  gravissima: 7,
}

export const SEVERITY_AMOUNT_CENTS: Record<Severity, number> = {
  leve: 8838,
  media: 13016,
  grave: 19523,
  gravissima: 29347,
}

export interface Infraction {
  code: string
  ctbArticle: string
  description: string
  severity: Severity
  multiplier: number
  usesEquipment: boolean
}

// Seeded from the codes most frequent in STTU editais; amounts verified
// against the edital values. Extend from DETRAN-RN's public infraction lookup.
export const INFRACTIONS: readonly Infraction[] = [
  {
    code: "7455",
    ctbArticle: "218, I",
    description:
      "Transitar em velocidade superior à máxima permitida em até 20%",
    severity: "media",
    multiplier: 1,
    usesEquipment: true,
  },
  {
    code: "7463",
    ctbArticle: "218, II",
    description:
      "Transitar em velocidade superior à máxima permitida em mais de 20% até 50%",
    severity: "grave",
    multiplier: 1,
    usesEquipment: true,
  },
  {
    code: "7471",
    ctbArticle: "218, III",
    description:
      "Transitar em velocidade superior à máxima permitida em mais de 50%",
    severity: "gravissima",
    multiplier: 3,
    usesEquipment: true,
  },
  {
    code: "7587",
    ctbArticle: "208",
    description: "Avançar o sinal vermelho do semáforo",
    severity: "gravissima",
    multiplier: 1,
    usesEquipment: true,
  },
  {
    code: "6050",
    ctbArticle: "252, parágrafo único",
    description: "Dirigir o veículo utilizando-se de telefone celular",
    severity: "gravissima",
    multiplier: 1,
    usesEquipment: false,
  },
  {
    code: "5185",
    ctbArticle: "167",
    description: "Deixar o condutor de usar o cinto de segurança",
    severity: "grave",
    multiplier: 1,
    usesEquipment: false,
  },
  {
    code: "5541",
    ctbArticle: "181, VIII",
    description: "Estacionar no passeio ou sobre faixa destinada a pedestre",
    severity: "grave",
    multiplier: 1,
    usesEquipment: false,
  },
]

export function normalizeInfractionCode(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 4)
}

export function findInfraction(code: string): Infraction | undefined {
  const normalized = normalizeInfractionCode(code)
  return INFRACTIONS.find((infraction) => infraction.code === normalized)
}

export function amountCents(infraction: Infraction): number {
  return SEVERITY_AMOUNT_CENTS[infraction.severity] * infraction.multiplier
}

export function points(infraction: Infraction): number {
  return SEVERITY_POINTS[infraction.severity]
}
