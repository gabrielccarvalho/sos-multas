import { randomUUID } from "node:crypto"

import { getStorage, type Storage } from "../storage"
import { addFile, getCaseByToken, transitionCase } from "./repository"
import {
  UPLOAD_EXTENSIONS,
  checkUpload,
  isPresentFile,
  type UploadCheck,
} from "./uploads"

export const MAX_SIGNED_FILES = 10

export type SignedResult =
  | { ok: true }
  | { ok: false; status: number; error: string }

export async function attachSignedPages(
  token: string,
  formData: FormData,
  deps: { storage: Storage } = { storage: getStorage() }
): Promise<SignedResult> {
  const found = await getCaseByToken(token)
  if (!found) return { ok: false, status: 404, error: "Caso não encontrado." }
  if (found.status !== "needs_signature") {
    return {
      ok: false,
      status: 409,
      error: "Esta etapa não está disponível agora.",
    }
  }

  const files = formData.getAll("signed").filter(isPresentFile)
  if (files.length === 0) {
    return {
      ok: false,
      status: 400,
      error: "Envie as fotos ou o PDF das páginas assinadas.",
    }
  }
  if (files.length > MAX_SIGNED_FILES) {
    return {
      ok: false,
      status: 400,
      error: `Envie no máximo ${MAX_SIGNED_FILES} arquivos.`,
    }
  }

  const accepted: Extract<UploadCheck, { ok: true }>[] = []
  for (const file of files) {
    const check = checkUpload(file, "Arquivo vazio.")
    if (!check.ok) {
      return {
        ok: false,
        status: check.status,
        error: `${file.name}: ${check.error}`,
      }
    }
    accepted.push(check)
  }

  for (const [index, { file, mime }] of accepted.entries()) {
    const bytes = Buffer.from(await file.arrayBuffer())
    const storageKey = await deps.storage.put(
      `cases/${found.id}/assinado-${index + 1}-${randomUUID()}.${UPLOAD_EXTENSIONS[mime]}`,
      bytes
    )
    await addFile(found.id, {
      kind: "signed_packet",
      storageKey,
      mime,
      sizeBytes: bytes.length,
      originalName: file.name,
    })
  }
  await transitionCase(found.id, "ready_to_file", {
    type: "case.signed_received",
    messagePt:
      "Recebemos os documentos assinados. Agora vamos protocolar a sua defesa.",
    actor: "user",
    metadata: { files: accepted.length },
  })
  return { ok: true }
}
