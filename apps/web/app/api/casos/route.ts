import { NextResponse } from "next/server"

import {
  addFile,
  createCase,
  saveExtraction,
  transitionCase,
} from "@/lib/cases/repository"
import {
  ExtractionFailedError,
  extractNotification,
  type NotificationMime,
} from "@/lib/extraction/extract-notification"
import { getStorage } from "@/lib/storage"

const ACCEPTED: Record<string, NotificationMime> = {
  "image/jpeg": "image/jpeg",
  "image/png": "image/png",
  "application/pdf": "application/pdf",
}

const EXTENSIONS: Record<NotificationMime, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "application/pdf": "pdf",
}

const MAX_BYTES = 10 * 1024 * 1024

export async function POST(request: Request) {
  const formData = await request.formData()
  const file = formData.get("notification")
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Envie a foto ou o PDF da notificação." },
      { status: 400 }
    )
  }
  const mime = ACCEPTED[file.type]
  if (!mime) {
    return NextResponse.json(
      { error: "Formato não aceito. Envie JPG, PNG ou PDF." },
      { status: 415 }
    )
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "O arquivo tem mais de 10 MB." },
      { status: 413 }
    )
  }

  const bytes = Buffer.from(await file.arrayBuffer())
  const created = await createCase()
  const storageKey = await getStorage().put(
    `cases/${created.id}/notification.${EXTENSIONS[mime]}`,
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
