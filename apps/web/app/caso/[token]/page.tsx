import { notFound } from "next/navigation"

import { Badge } from "@workspace/ui/components/badge"

import { getCaseDetails } from "@/lib/cases/repository"
import { STATUS_LABELS } from "@/lib/domain/status"

const dateFormat = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Fortaleza",
})

export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const details = await getCaseDetails(token)
  if (!details) notFound()

  return (
    <main className="mx-auto flex min-h-svh max-w-xl flex-col gap-8 p-6">
      <div className="flex flex-col gap-3">
        <h1 className="font-heading text-2xl font-semibold">Seu caso</h1>
        <div>
          <Badge>{STATUS_LABELS[details.case.status]}</Badge>
        </div>
        {details.case.placa ? (
          <p className="text-sm text-muted-foreground">
            Placa {details.case.placa}
            {details.case.aitNumber ? ` · Auto ${details.case.aitNumber}` : ""}
          </p>
        ) : null}
      </div>
      <ol className="flex flex-col gap-4">
        {details.events.map((event) => (
          <li key={event.id} className="flex flex-col gap-1">
            <span className="text-sm">{event.messagePt}</span>
            <span className="font-mono text-xs text-muted-foreground">
              {dateFormat.format(event.createdAt)}
            </span>
          </li>
        ))}
      </ol>
    </main>
  )
}
