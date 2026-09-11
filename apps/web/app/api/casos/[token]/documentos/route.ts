import { NextResponse } from "next/server"

import { attachDocuments } from "@/lib/cases/attach-documents"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const result = await attachDocuments(token, await request.formData())
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  return NextResponse.json({ outcome: result.outcome })
}
