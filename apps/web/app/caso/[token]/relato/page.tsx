import { notFound, redirect } from "next/navigation"

import { getCaseDetails } from "@/lib/cases/repository"
import { answerToValue, narrativeSchema } from "@/lib/cases/story-form-schema"
import { formatCpf } from "@/lib/domain/cpf"
import { StoryForm, type StoryDefaults } from "./story-form"

export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const details = await getCaseDetails(token)
  if (!details) notFound()
  if (details.case.status !== "needs_documents") redirect(`/caso/${token}`)

  const current = details.case
  const stored = narrativeSchema.safeParse(current.narrative)
  const answers = stored.success ? stored.data.answers : null
  const defaults: StoryDefaults = {
    answers: answers
      ? {
          wasDriving: answerToValue(answers.wasDriving),
          plateMatches: answerToValue(answers.plateMatches),
          locationMatches: answerToValue(answers.locationMatches),
          signageVisible: answerToValue(answers.signageVisible),
        }
      : {},
    values: {
      details: stored.success ? stored.data.details : "",
      ownerName: current.ownerName ?? "",
      ownerCpf: current.ownerCpf ? formatCpf(current.ownerCpf) : "",
      ownerIdDocument: current.ownerIdDocument ?? "",
      ownerCnhNumber: current.ownerCnhNumber ?? "",
      ownerEmail: current.ownerEmail ?? "",
      ownerPhone: current.ownerPhone ?? "",
      ownerAddress: current.ownerAddress ?? "",
      ownerAddressNumber: current.ownerAddressNumber ?? "",
      ownerAddressComplement: current.ownerAddressComplement ?? "",
      ownerDistrict: current.ownerDistrict ?? "",
      ownerCity: current.ownerCity ?? "Natal",
      ownerState: current.ownerState ?? "RN",
      ownerCep: current.ownerCep ?? "",
      placaUf: current.placaUf ?? "RN",
    },
  }

  return (
    <main className="mx-auto flex min-h-svh max-w-2xl flex-col gap-8 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl font-semibold">
          Conte o que aconteceu
        </h1>
        <p className="text-sm text-muted-foreground">
          Suas respostas escolhem os argumentos da defesa. Responda com
          sinceridade: uma defesa com fatos falsos pode ser negada e trazer
          problemas para você.
        </p>
      </div>
      <StoryForm token={token} defaults={defaults} />
    </main>
  )
}
