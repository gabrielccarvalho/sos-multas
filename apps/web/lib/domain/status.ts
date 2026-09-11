export const CASE_STATUSES = [
  "received",
  "needs_review",
  "needs_documents",
  "needs_signature",
  "ready_to_file",
  "filed",
  "under_review",
  "decided_granted",
  "decided_denied",
  "cancelled",
] as const

export type CaseStatus = (typeof CASE_STATUSES)[number]

export const STATUS_LABELS: Record<CaseStatus, string> = {
  received: "Recebemos sua multa",
  needs_review: "Confira os dados",
  needs_documents: "Faltam documentos",
  needs_signature: "Assine e envie",
  ready_to_file: "Pronto para protocolar",
  filed: "Protocolado",
  under_review: "Em análise pelo órgão",
  decided_granted: "Defesa aceita",
  decided_denied: "Defesa negada",
  cancelled: "Cancelado",
}

const TRANSITIONS: Record<CaseStatus, readonly CaseStatus[]> = {
  received: ["needs_review", "cancelled"],
  needs_review: ["needs_documents", "cancelled"],
  needs_documents: ["needs_signature", "cancelled"],
  needs_signature: ["ready_to_file", "needs_documents", "cancelled"],
  ready_to_file: ["filed", "needs_signature", "cancelled"],
  filed: ["under_review", "cancelled"],
  under_review: ["decided_granted", "decided_denied"],
  decided_granted: [],
  decided_denied: [],
  cancelled: [],
}

export class InvalidTransitionError extends Error {
  readonly from: CaseStatus
  readonly to: CaseStatus

  constructor(from: CaseStatus, to: CaseStatus) {
    super(`Cannot move a case from ${from} to ${to}`)
    this.name = "InvalidTransitionError"
    this.from = from
    this.to = to
  }
}

export function canTransition(from: CaseStatus, to: CaseStatus): boolean {
  return TRANSITIONS[from].includes(to)
}

export function assertTransition(from: CaseStatus, to: CaseStatus): void {
  if (!canTransition(from, to)) throw new InvalidTransitionError(from, to)
}

export function isTerminal(status: CaseStatus): boolean {
  return TRANSITIONS[status].length === 0
}
