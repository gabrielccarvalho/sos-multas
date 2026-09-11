import { NextResponse } from "next/server"

import {
  addFile,
  createCase,
  saveExtraction,
  transitionCase,
} from "@/lib/cases/repository"
import { UPLOAD_EXTENSIONS, checkUpload } from "@/lib/cases/uploads"
import {
  ExtractionFailedError,
  extractNotification,
} from "@/lib/extraction/extract-notification"
import { getStorage } from "@/lib/storage"

export async function POST(request: Request) {
  const formData = await request.formData()
  const check = checkUpload(
    formData.get("notification"),
    "Envie a foto ou o PDF da notificação."
  )
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }
  const { file, mime } = check

  const bytes = Buffer.from(await file.arrayBuffer())
  const created = await createCase()
  const storageKey = await getStorage().put(
    `cases/${created.id}/notification.${UPLOAD_EXTENSIONS[mime]}`,
    bytes
  )
  await addFile(created.id, {
    kind: "notification",
    storageKey,
    mime,
    sizeBytes: bytes.length,
    originalName: file.name,
  })

  try {
    const result = await extractNotification({ bytes, mime })
    await saveExtraction(created.id, {
      model: result.model,
      promptVersion: result.promptVersion,
      raw: result.raw,
      normalized: result.extracted,
    })
    await transitionCase(created.id, "needs_review", {
      type: "case.extracted",
      messagePt: "Lemos os dados da notificação. Confira se está tudo certo.",
      actor: "system",
    })
  } catch (error) {
    const reason =
      error instanceof ExtractionFailedError ? error.message : String(error)
    console.error("extraction failed", { caseId: created.id, reason })
    await transitionCase(created.id, "needs_review", {
      type: "case.extraction_failed",
      messagePt:
        "Não conseguimos ler a notificação automaticamente. Preencha os dados manualmente.",
      actor: "system",
      metadata: { reason },
    })
  }

  return NextResponse.json({ token: created.token })
}
