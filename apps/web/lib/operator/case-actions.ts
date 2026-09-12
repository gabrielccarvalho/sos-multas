import { randomUUID } from "node:crypto"

import {
  addEvent,
  addFile,
  getCaseDetailsById,
  transitionCase,
  type CaseDataUpdate,
  type CaseDetails,
  type NewEvent,
} from "../cases/repository"
import { UPLOAD_EXTENSIONS, checkUpload, isPresentFile } from "../cases/uploads"
import type { CaseFileRow } from "../db/schema"
import { InvalidTransitionError, type CaseStatus } from "../domain/status"
import { getStorage, type Storage } from "../storage"

export type OperatorResult = { ok: true } | { ok: false; error: string }

export interface OperatorDeps {
  storage: Storage
  now: () => Date
}

const defaultDeps = (): OperatorDeps => ({
  storage: getStorage(),
  now: () => new Date(),
})

const MAX_TEXT = 1000
const NOT_FOUND: OperatorResult = { ok: false, error: "Caso não encontrado." }
const WRONG_STATUS: OperatorResult = {
  ok: false,
  error: "Esta ação não é possível no status atual do caso.",
}

type Text = { ok: true; text: string } | { ok: false; error: string }

function readText(value: string | null | undefined, missing: string): Text {
  const text = value?.trim() ?? ""
  if (text === "") return { ok: false, error: missing }
  if (text.length > MAX_TEXT) {
    return { ok: false, error: "Use no máximo 1.000 caracteres." }
  }
  return { ok: true, text }
}

async function move(
  caseId: string,
  to: CaseStatus,
  event: NewEvent,
  data?: CaseDataUpdate
): Promise<OperatorResult> {
  try {
    await transitionCase(caseId, to, event, undefined, data)
    return { ok: true }
  } catch (error) {
    if (error instanceof InvalidTransitionError) return WRONG_STATUS
    throw error
  }
}

async function attach(
  details: CaseDetails,
  kind: CaseFileRow["kind"],
  label: string,
  file: File | null,
  deps: OperatorDeps
): Promise<OperatorResult> {
  if (!isPresentFile(file)) return { ok: true }
  const check = checkUpload(file, label)
  if (!check.ok) return { ok: false, error: `${label}: ${check.error}` }
  const bytes = Buffer.from(await file.arrayBuffer())
  const storageKey = await deps.storage.put(
    `cases/${details.case.id}/${kind}-${randomUUID()}.${UPLOAD_EXTENSIONS[check.mime]}`,
    bytes
  )
  await addFile(details.case.id, {
    kind,
    storageKey,
    mime: check.mime,
    sizeBytes: bytes.length,
    originalName: file.name,
  })
  return { ok: true }
}

export async function requestCorrection(
  caseId: string,
  message: string
): Promise<OperatorResult> {
  const read = readText(message, "Escreva o que precisa ser corrigido.")
  if (!read.ok) return read
  const details = await getCaseDetailsById(caseId)
  if (!details) return NOT_FOUND
  const back: Partial<Record<CaseStatus, CaseStatus>> = {
    ready_to_file: "needs_signature",
    needs_signature: "needs_documents",
  }
  const target = back[details.case.status]
  if (!target) {
    return {
      ok: false,
      error: "Só é possível pedir correção antes do protocolo.",
    }
  }
  return move(caseId, target, {
    type: "operator.correction_requested",
    messagePt: `Precisamos de um ajuste: ${read.text}`,
    actor: "operator",
    metadata: { from: details.case.status },
  })
}

export async function markFiled(
  caseId: string,
  input: { protocolNumber: string; receipt: File | null },
  deps: OperatorDeps = defaultDeps()
): Promise<OperatorResult> {
  const protocolNumber = input.protocolNumber.trim()
  if (!protocolNumber) {
    return { ok: false, error: "Informe o número do protocolo." }
  }
  const details = await getCaseDetailsById(caseId)
  if (!details) return NOT_FOUND
  if (details.case.status !== "ready_to_file") return WRONG_STATUS
  const attached = await attach(
    details,
    "receipt",
    "Comprovante",
    input.receipt,
    deps
  )
  if (!attached.ok) return attached
  return move(
    caseId,
    "filed",
    {
      type: "case.filed",
      messagePt: `Protocolamos a sua defesa junto ao órgão. Número do protocolo: ${protocolNumber}.`,
      actor: "operator",
      metadata: { protocolNumber },
    },
    { protocolNumber, filedAt: deps.now() }
  )
}

export async function markUnderReview(caseId: string): Promise<OperatorResult> {
  const details = await getCaseDetailsById(caseId)
  if (!details) return NOT_FOUND
  return move(caseId, "under_review", {
    type: "case.under_review",
    messagePt:
      "O órgão está analisando a sua defesa. Avisaremos aqui quando houver decisão.",
    actor: "operator",
  })
}

export async function recordDecision(
  caseId: string,
  input: { granted: boolean; note: string | null; document: File | null },
  deps: OperatorDeps = defaultDeps()
): Promise<OperatorResult> {
  const note = input.note?.trim() ?? ""
  if (note.length > MAX_TEXT) {
    return { ok: false, error: "Use no máximo 1.000 caracteres." }
  }
  const details = await getCaseDetailsById(caseId)
  if (!details) return NOT_FOUND
  if (details.case.status !== "under_review") return WRONG_STATUS
  const attached = await attach(
    details,
    "decision",
    "Decisão",
    input.document,
    deps
  )
  if (!attached.ok) return attached
  const outcome = input.granted
    ? "A sua defesa foi aceita. O auto de infração foi arquivado."
    : "A sua defesa foi negada."
  return move(caseId, input.granted ? "decided_granted" : "decided_denied", {
    type: "case.decided",
    messagePt: note ? `${outcome} ${note}` : outcome,
    actor: "operator",
    metadata: { granted: input.granted },
  })
}

export async function addOperatorNote(
  caseId: string,
  message: string
): Promise<OperatorResult> {
  const read = readText(message, "Escreva a atualização.")
  if (!read.ok) return read
  const details = await getCaseDetailsById(caseId)
  if (!details) return NOT_FOUND
  await addEvent(caseId, {
    type: "operator.note",
    messagePt: read.text,
    actor: "operator",
  })
  return { ok: true }
}

export async function cancelCase(
  caseId: string,
  reason: string
): Promise<OperatorResult> {
  const read = readText(reason, "Informe o motivo do cancelamento.")
  if (!read.ok) return read
  const details = await getCaseDetailsById(caseId)
  if (!details) return NOT_FOUND
  return move(caseId, "cancelled", {
    type: "case.cancelled",
    messagePt: `O caso foi cancelado: ${read.text}`,
    actor: "operator",
  })
}
