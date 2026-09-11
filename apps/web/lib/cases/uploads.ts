export type UploadMime = "image/jpeg" | "image/png" | "application/pdf"

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

export const UPLOAD_EXTENSIONS: Record<UploadMime, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "application/pdf": "pdf",
}

export type UploadCheck =
  | { ok: true; file: File; mime: UploadMime }
  | { ok: false; status: 400 | 413 | 415; error: string }

function isUploadMime(type: string): type is UploadMime {
  return Object.hasOwn(UPLOAD_EXTENSIONS, type)
}

export function isPresentFile(value: FormDataEntryValue | null): value is File {
  return value instanceof File && value.size > 0
}

export function checkUpload(
  value: FormDataEntryValue | null,
  missingMessage: string
): UploadCheck {
  if (!isPresentFile(value)) {
    return { ok: false, status: 400, error: missingMessage }
  }
  if (!isUploadMime(value.type)) {
    return {
      ok: false,
      status: 415,
      error: "Formato não aceito. Envie JPG, PNG ou PDF.",
    }
  }
  if (value.size > MAX_UPLOAD_BYTES) {
    return { ok: false, status: 413, error: "O arquivo tem mais de 10 MB." }
  }
  return { ok: true, file: value, mime: value.type }
}
