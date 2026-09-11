import { notFound } from "next/navigation"

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

import { ButtonLink } from "@/components/button-link"
import { caseProgress } from "@/lib/cases/progress"
import { getCaseDetails, type CaseDetails } from "@/lib/cases/repository"
import { formatIsoDate, localIsoDate } from "@/lib/documents/format"
import { daysUntil } from "@/lib/domain/deadlines"
import { STATUS_LABELS } from "@/lib/domain/status"

const dateFormat = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Fortaleza",
})

function deadlineLine(details: CaseDetails): string | null {
  const { stage, deadlineDefense, deadlineAppeal } = details.case
  const deadline = stage === "NIP" ? deadlineAppeal : deadlineDefense
  if (!deadline) return null
  const today = new Date(`${localIsoDate(new Date())}T00:00:00Z`)
  const remaining = daysUntil(new Date(`${deadline}T00:00:00Z`), today)
  const label = stage === "NIP" ? "Prazo para recurso" : "Prazo para defesa"
  const when =
    remaining < 0
      ? "prazo vencido"
      : remaining === 0
        ? "vence hoje"
        : remaining === 1
          ? "falta 1 dia"
          : `faltam ${remaining} dias`
  return `${label}: ${formatIsoDate(deadline)} (${when})`
}

function Step({
  done,
  title,
  href,
  action,
}: {
  done: boolean
  title: string
  href: string
  action: string
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-2 text-sm">
        {title}
        {done ? <Badge variant="secondary">Feito</Badge> : null}
      </div>
      <ButtonLink href={href} size="sm" variant={done ? "outline" : "default"}>
        {done ? "Editar" : action}
      </ButtonLink>
    </div>
  )
}

function NextStep({ details, token }: { details: CaseDetails; token: string }) {
  const base = `/caso/${token}`
  const progress = caseProgress(details)
  switch (details.case.status) {
    case "needs_review":
      return (
        <Card>
          <CardHeader>
            <CardTitle>Confira os dados da notificação</CardTitle>
            <CardDescription>
              Compare o que lemos com a carta antes de seguir.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <ButtonLink href={`${base}/conferir`}>Conferir dados</ButtonLink>
          </CardFooter>
        </Card>
      )
    case "needs_documents":
      return (
        <Card>
          <CardHeader>
            <CardTitle>Complete o seu caso</CardTitle>
            <CardDescription>
              Quando as duas etapas estiverem prontas, preparamos os documentos
              para você assinar.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Step
              done={progress.hasStory}
              title="Conte o que aconteceu e informe seus dados"
              href={`${base}/relato`}
              action="Preencher"
            />
            <Step
              done={progress.hasCnh && progress.hasCrlv}
              title="Envie a CNH e o CRLV"
              href={`${base}/documentos`}
              action="Enviar"
            />
          </CardContent>
        </Card>
      )
    case "needs_signature":
      return (
        <Card>
          <CardHeader>
            <CardTitle>Assine os documentos</CardTitle>
            <CardDescription>
              Imprima, assine e envie de volta as páginas assinadas.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <ButtonLink href={`${base}/assinar`}>Ver documentos</ButtonLink>
          </CardFooter>
        </Card>
      )
    case "ready_to_file":
      return (
        <Card>
          <CardHeader>
            <CardTitle>Tudo pronto</CardTitle>
            <CardDescription>
              Recebemos os documentos assinados. Vamos protocolar a sua defesa e
              avisar aqui cada novidade.
            </CardDescription>
          </CardHeader>
        </Card>
      )
    default:
      return null
  }
}

export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const details = await getCaseDetails(token)
  if (!details) notFound()
  const current = details.case
  const deadline = deadlineLine(details)

  return (
    <main className="mx-auto flex min-h-svh max-w-xl flex-col gap-8 p-6">
      <div className="flex flex-col gap-3">
        <h1 className="font-heading text-2xl font-semibold">Seu caso</h1>
        <div>
          <Badge>{STATUS_LABELS[current.status]}</Badge>
        </div>
        {current.placa ? (
          <p className="text-sm text-muted-foreground">
            Placa {current.placa}
            {current.aitNumber ? ` · Auto ${current.aitNumber}` : ""}
          </p>
        ) : null}
        {deadline ? <p className="text-sm font-medium">{deadline}</p> : null}
      </div>
      {current.orgao === "OTHER" ? (
        <Alert>
          <AlertTitle>Órgão não atendido</AlertTitle>
          <AlertDescription>
            Este auto não é da STTU nem do DETRAN-RN. Por enquanto só preparamos
            defesas para esses dois órgãos.
          </AlertDescription>
        </Alert>
      ) : (
        <NextStep details={details} token={token} />
      )}
      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-medium">Histórico</h2>
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
      </section>
    </main>
  )
}
