import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

import { ButtonLink } from "@/components/button-link"
import { nextDeadline } from "@/lib/cases/next-deadline"
import { listCases } from "@/lib/cases/repository"
import { formatIsoDate, localIsoDate } from "@/lib/documents/format"
import { daysUntil } from "@/lib/domain/deadlines"
import {
  CASE_STATUSES,
  STATUS_LABELS,
  type CaseStatus,
} from "@/lib/domain/status"
import { runWarnings } from "./actions"

const dateFormat = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeZone: "America/Fortaleza",
})

function isStatus(value: string | undefined): value is CaseStatus {
  return CASE_STATUSES.includes((value ?? "") as CaseStatus)
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status } = await searchParams
  const filter = isStatus(status) ? status : undefined
  const cases = await listCases(filter ? { status: filter } : {})
  const today = new Date(`${localIsoDate(new Date())}T00:00:00Z`)

  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-heading text-xl font-semibold">
          Casos ({cases.length})
        </h1>
        <form action={runWarnings}>
          <Button type="submit" variant="outline" size="sm">
            Verificar prazos
          </Button>
        </form>
      </div>
      <div className="flex flex-wrap gap-2">
        <ButtonLink
          href="/admin"
          size="xs"
          variant={filter ? "outline" : "default"}
        >
          Todos
        </ButtonLink>
        {CASE_STATUSES.map((value) => (
          <ButtonLink
            key={value}
            href={`/admin?status=${value}`}
            size="xs"
            variant={filter === value ? "default" : "outline"}
          >
            {STATUS_LABELS[value]}
          </ButtonLink>
        ))}
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Criado</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Órgão</TableHead>
              <TableHead>Placa</TableHead>
              <TableHead>Auto</TableHead>
              <TableHead>Prazo</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {cases.map((row) => {
              const deadline = nextDeadline(row)
              const remaining = deadline
                ? daysUntil(new Date(`${deadline}T00:00:00Z`), today)
                : null
              return (
                <TableRow key={row.id}>
                  <TableCell>{dateFormat.format(row.createdAt)}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {STATUS_LABELS[row.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>{row.orgao ?? "—"}</TableCell>
                  <TableCell className="font-mono">
                    {row.placa ?? "—"}
                  </TableCell>
                  <TableCell className="font-mono">
                    {row.aitNumber ?? "—"}
                  </TableCell>
                  <TableCell>
                    {deadline ? (
                      <span
                        className={
                          remaining !== null && remaining <= 5
                            ? "font-medium text-destructive"
                            : undefined
                        }
                      >
                        {formatIsoDate(deadline)}
                        {remaining !== null ? ` (${remaining}d)` : ""}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <ButtonLink
                      href={`/admin/casos/${row.id}`}
                      size="xs"
                      variant="outline"
                    >
                      Abrir
                    </ButtonLink>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </main>
  )
}
