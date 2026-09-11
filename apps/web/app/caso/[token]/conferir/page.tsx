import Image from "next/image"
import { notFound, redirect } from "next/navigation"

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@workspace/ui/components/empty"

import { getCaseDetails } from "@/lib/cases/repository"
import {
  extractedNotificationSchema,
  lowConfidenceFields,
  type ExtractedField,
  type ExtractedNotification,
} from "@/lib/domain/extraction-schema"
import { detectStage } from "@/lib/domain/stage"
import {
  ReviewForm,
  type ReviewDefaults,
  type ReviewFieldName,
} from "./review-form"

function reviewFieldName(key: ExtractedField): ReviewFieldName | null {
  if (key === "documentTitle") return null
  if (key === "amountCents") return "amountReais"
  return key
}

function toDefaults(extracted: ExtractedNotification | null): ReviewDefaults {
  if (!extracted) return { stage: "NA", values: {}, lowConfidence: [] }
  const values: Partial<Record<ReviewFieldName, string>> = {}
  for (const key of Object.keys(extracted) as ExtractedField[]) {
    const name = reviewFieldName(key)
    const { value } = extracted[key]
    if (!name || value === null) continue
    if (name === "amountReais" && typeof value === "number") {
      values[name] = (value / 100).toFixed(2).replace(".", ",")
    } else if (name === "occurredAt" && typeof value === "string") {
      values[name] = value.slice(0, 16)
    } else {
      values[name] = String(value)
    }
  }
  const stage =
    detectStage({
      documentTitle: extracted.documentTitle.value,
      hasAmount: extracted.amountCents.value !== null,
      hasDefenseDeadline: extracted.deadlineDefense.value !== null,
    }) ?? "NA"
  const lowConfidence = lowConfidenceFields(extracted)
    .map(reviewFieldName)
    .filter((name): name is ReviewFieldName => name !== null)
  return { stage, values, lowConfidence }
}

export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const details = await getCaseDetails(token)
  if (!details) notFound()
  if (details.case.status !== "needs_review") redirect(`/caso/${token}`)

  const notification = details.files.find(
    (file) => file.kind === "notification"
  )
  const parsed = details.extraction
    ? extractedNotificationSchema.safeParse(details.extraction.normalized)
    : null
  const extracted = parsed?.success ? parsed.data : null
  const fileUrl = notification
    ? `/caso/${token}/arquivo/${notification.id}`
    : null

  return (
    <main className="mx-auto flex min-h-svh max-w-6xl flex-col gap-8 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl font-semibold">
          Confira os dados
        </h1>
        <p className="text-sm text-muted-foreground">
          {extracted
            ? "Lemos a notificação. Compare cada campo com a carta e corrija o que estiver diferente."
            : "Não conseguimos ler a notificação automaticamente. Preencha os campos olhando a carta."}
        </p>
      </div>
      <div className="grid gap-8 lg:grid-cols-2">
        <section className="lg:sticky lg:top-6 lg:self-start">
          {fileUrl && notification?.mime === "application/pdf" ? (
            <iframe
              src={fileUrl}
              title="Notificação"
              className="h-[80svh] w-full rounded-lg border"
            />
          ) : fileUrl ? (
            <Image
              src={fileUrl}
              alt="Notificação enviada"
              width={900}
              height={1200}
              unoptimized
              className="h-auto w-full rounded-lg border"
            />
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>Sem arquivo</EmptyTitle>
                <EmptyDescription>
                  A notificação não foi encontrada.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </section>
        <ReviewForm token={token} defaults={toDefaults(extracted)} />
      </div>
    </main>
  )
}
