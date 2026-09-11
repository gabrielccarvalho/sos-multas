import { NextResponse } from "next/server"

import { attachSignedPages } from "@/lib/cases/attach-signed-pages"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const result = await attachSignedPages(token, await request.formData())
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  return NextResponse.json({ ok: true })
}
