import { notFound, redirect } from "next/navigation"

import { caseProgress } from "@/lib/cases/progress"
import { getCaseDetails } from "@/lib/cases/repository"
import { DocumentsForm } from "./documents-form"

export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const details = await getCaseDetails(token)
  if (!details) notFound()
  if (details.case.status !== "needs_documents") redirect(`/caso/${token}`)
  const progress = caseProgress(details)

  return (
    <main className="mx-auto flex min-h-svh max-w-xl flex-col gap-8 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl font-semibold">
          Envie a CNH e o CRLV
        </h1>
        <p className="text-sm text-muted-foreground">
          Os documentos vão junto com a defesa e comprovam a sua assinatura.
          Aceitamos JPG, PNG ou PDF de até 10 MB.
        </p>
      </div>
      <DocumentsForm
        token={token}
        hasCnh={progress.hasCnh}
        hasCrlv={progress.hasCrlv}
      />
    </main>
  )
}
