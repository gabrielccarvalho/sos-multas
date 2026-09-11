import { randomUUID } from "node:crypto"

import {
  defaultPacketDeps,
  generatePacketIfReady,
  type PacketDeps,
  type PacketOutcome,
} from "./generate-packet"
import { addEvent, addFile, getCaseByToken } from "./repository"
import {
  UPLOAD_EXTENSIONS,
  checkUpload,
  isPresentFile,
  type UploadMime,
} from "./uploads"

const DOCUMENTS = [
  { kind: "cnh", label: "CNH", received: "a CNH" },
  { kind: "crlv", label: "CRLV", received: "o CRLV" },
] as const

type DocumentKind = (typeof DOCUMENTS)[number]["kind"]

export type AttachResult =
  | { ok: true; outcome: PacketOutcome }
  | { ok: false; status: number; error: string }

export async function attachDocuments(
  token: string,
  formData: FormData,
  deps: PacketDeps = defaultPacketDeps()
): Promise<AttachResult> {
  const found = await getCaseByToken(token)
  if (!found) return { ok: false, status: 404, error: "Caso não encontrado." }
  if (found.status !== "needs_documents") {
    return {
      ok: false,
      status: 409,
      error: "Esta etapa não está disponível agora.",
    }
  }

  const accepted: {
    kind: DocumentKind
    received: string
    file: File
    mime: UploadMime
  }[] = []
  for (const { kind, label, received } of DOCUMENTS) {
    const value = formData.get(kind)
    if (!isPresentFile(value)) continue
    const check = checkUpload(value, label)
    if (!check.ok) {
      return {
        ok: false,
        status: check.status,
        error: `${label}: ${check.error}`,
      }
    }
    accepted.push({ kind, received, file: check.file, mime: check.mime })
  }
  if (accepted.length === 0) {
    return { ok: false, status: 400, error: "Envie a CNH e o CRLV." }
  }

  for (const { kind, file, mime } of accepted) {
    const bytes = Buffer.from(await file.arrayBuffer())
    const storageKey = await deps.storage.put(
      `cases/${found.id}/${kind}-${randomUUID()}.${UPLOAD_EXTENSIONS[mime]}`,
      bytes
    )
    await addFile(found.id, {
      kind,
      storageKey,
      mime,
      sizeBytes: bytes.length,
      originalName: file.name,
    })
  }
  await addEvent(found.id, {
    type: "case.documents_received",
    messagePt: `Recebemos ${accepted.map((document) => document.received).join(" e ")}.`,
    actor: "user",
  })
  return { ok: true, outcome: await generatePacketIfReady(token, deps) }
}
