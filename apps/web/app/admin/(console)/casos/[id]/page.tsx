import { notFound } from "next/navigation"

import { Badge } from "@workspace/ui/components/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

import { ButtonLink } from "@/components/button-link"
import { getCaseDetailsById } from "@/lib/cases/repository"
import { formatIsoDate } from "@/lib/documents/format"
import { formatCpf } from "@/lib/domain/cpf"
import { STATUS_LABELS } from "@/lib/domain/status"
import type { CaseFileRow } from "@/lib/db/schema"
import { OperatorActions } from "./operator-forms"

const FILE_LABELS: Record<CaseFileRow["kind"], string> = {
  notification: "Notificação",
  cnh: "CNH",
  crlv: "CRLV",
  packet: "Pacote para assinar",
  signed_packet: "Página assinada",
  receipt: "Comprovante de protocolo",
  decision: "Decisão",
}

const dateTime = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Fortaleza",
})

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between gap-4 py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value ?? "—"}</span>
    </div>
  )
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const details = await getCaseDetailsById(id)
  if (!details) notFound()
  const current = details.case

  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="font-heading text-xl font-semibold">
            {current.placa ?? "Caso"}
          </h1>
          <Badge>{STATUS_LABELS[current.status]}</Badge>
        </div>
        <ButtonLink
          href={`/caso/${current.token}`}
          size="sm"
          variant="outline"
          target="_blank"
          rel="noreferrer"
        >
          Ver como o cliente
        </ButtonLink>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Dados do caso</CardTitle>
          </CardHeader>
          <CardContent>
            <Row label="Órgão" value={current.orgao} />
            <Row label="Etapa" value={current.stage} />
            <Row label="Auto de infração" value={current.aitNumber} />
            <Row
              label="Infração"
              value={
                current.infractionCode
                  ? `${current.infractionCode} ${current.infractionDescription ?? ""}`.trim()
                  : null
              }
            />
            <Row
              label="Ocorrida em"
              value={
                current.occurredAt ? dateTime.format(current.occurredAt) : null
              }
            />
            <Row label="Local" value={current.location} />
            <Row
              label="Prazo de defesa"
              value={
                current.deadlineDefense
                  ? formatIsoDate(current.deadlineDefense)
                  : null
              }
            />
            <Row
              label="Prazo de recurso"
              value={
                current.deadlineAppeal
                  ? formatIsoDate(current.deadlineAppeal)
                  : null
              }
            />
            <Row label="Protocolo" value={current.protocolNumber} />
            <Row
              label="Protocolado em"
              value={current.filedAt ? dateTime.format(current.filedAt) : null}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Requerente</CardTitle>
          </CardHeader>
          <CardContent>
            <Row label="Nome" value={current.ownerName} />
            <Row
              label="CPF"
              value={current.ownerCpf ? formatCpf(current.ownerCpf) : null}
            />
            <Row label="E-mail" value={current.ownerEmail} />
            <Row label="Telefone" value={current.ownerPhone} />
            <Row
              label="Endereço"
              value={
                current.ownerAddress
                  ? `${current.ownerAddress}, ${current.ownerAddressNumber ?? "s/n"}, ${current.ownerDistrict ?? ""}, ${current.ownerCity ?? ""}/${current.ownerState ?? ""}`
                  : null
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Arquivos</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {details.files.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum arquivo.</p>
            ) : (
              details.files.map((file) => (
                <a
                  key={file.id}
                  href={`/caso/${current.token}/arquivo/${file.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm underline underline-offset-4"
                >
                  {FILE_LABELS[file.kind]} · {file.originalName ?? file.mime}
                </a>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ações</CardTitle>
          </CardHeader>
          <CardContent>
            <OperatorActions id={current.id} status={current.status} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Histórico</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {details.events.map((event) => (
            <div key={event.id} className="flex flex-col gap-0.5">
              <span className="text-sm">{event.messagePt}</span>
              <span className="font-mono text-xs text-muted-foreground">
                {dateTime.format(event.createdAt)} · {event.actor} ·{" "}
                {event.type}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </main>
  )
}
