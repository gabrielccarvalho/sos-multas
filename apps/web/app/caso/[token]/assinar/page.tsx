import { notFound, redirect } from "next/navigation"

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"

import { caseProgress } from "@/lib/cases/progress"
import { getCaseDetails } from "@/lib/cases/repository"
import { narrativeSchema } from "@/lib/cases/story-form-schema"
import { buildPacketContent } from "@/lib/documents/packet-content"
import { procuradorFromEnv } from "@/lib/documents/procurador"
import { SignedForm } from "./signed-form"

export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const details = await getCaseDetails(token)
  if (!details) notFound()
  if (details.case.status !== "needs_signature") redirect(`/caso/${token}`)

  const { packet } = caseProgress(details)
  const content = buildPacketContent({
    caseData: details.case,
    narrative: narrativeSchema.parse(details.case.narrative),
    procurador: procuradorFromEnv(),
    today: new Date(),
  })

  return (
    <main className="mx-auto flex min-h-svh max-w-xl flex-col gap-8 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl font-semibold">
          Assine os documentos
        </h1>
        <p className="text-sm text-muted-foreground">
          Preparamos o requerimento, a defesa e a procuração. Falta a sua
          assinatura.
        </p>
      </div>
      {content.defesa.hasSpecificGrounds ? null : (
        <Alert>
          <AlertTitle>Defesa sem argumento específico</AlertTitle>
          <AlertDescription>
            Pelas suas respostas, não encontramos uma falha concreta no auto.
            Vamos pedir a verificação dos requisitos formais, mas as chances de
            sucesso são menores.
          </AlertDescription>
        </Alert>
      )}
      <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm">
        <li>Baixe e imprima o pacote.</li>
        <li>
          Assine em todas as linhas indicadas, com a mesma assinatura da sua CNH
          ou RG.
        </li>
        {content.indicacao ? (
          <li>
            Peça ao condutor que preencha e assine o formulário de indicação, e
            envie também uma foto da CNH dele.
          </li>
        ) : null}
        <li>Fotografe ou escaneie cada página assinada e envie abaixo.</li>
      </ol>
      {packet ? (
        <Button
          variant="outline"
          nativeButton={false}
          render={
            <a
              href={`/caso/${token}/arquivo/${packet.id}`}
              target="_blank"
              rel="noreferrer"
            />
          }
        >
          Baixar o pacote (PDF)
        </Button>
      ) : null}
      <SignedForm token={token} />
    </main>
  )
}
