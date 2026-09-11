import { getCaseDetails } from "@/lib/cases/repository"
import { getStorage } from "@/lib/storage"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string; fileId: string }> }
) {
  const { token, fileId } = await params
  const details = await getCaseDetails(token)
  const file = details?.files.find((candidate) => candidate.id === fileId)
  if (!file) return new Response("Not found", { status: 404 })
  const body = await getStorage().get(file.storageKey)
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": file.mime,
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
    },
  })
}
