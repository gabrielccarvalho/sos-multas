"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Spinner } from "@workspace/ui/components/spinner"

const ACCEPT = "image/jpeg,image/png,application/pdf"

export function DocumentsForm({
  token,
  hasCnh,
  hasCrlv,
}: {
  token: string
  hasCnh: boolean
  hasCrlv: boolean
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)
    const response = await fetch(`/api/casos/${token}/documentos`, {
      method: "POST",
      body: new FormData(event.currentTarget),
    })
    const data = (await response.json()) as { error?: string }
    if (!response.ok) {
      setError(data.error ?? "Não foi possível enviar. Tente de novo.")
      setPending(false)
      return
    }
    router.push(`/caso/${token}`)
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <Field>
        <FieldLabel htmlFor="cnh">
          CNH ou documento de identidade com foto
          {hasCnh ? <Badge variant="secondary">Recebido</Badge> : null}
        </FieldLabel>
        <Input
          id="cnh"
          name="cnh"
          type="file"
          accept={ACCEPT}
          required={!hasCnh}
          disabled={pending}
        />
        <FieldDescription>
          A CNH digital em PDF ou uma foto nítida do documento aberto.
        </FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor="crlv">
          CRLV (documento do veículo)
          {hasCrlv ? <Badge variant="secondary">Recebido</Badge> : null}
        </FieldLabel>
        <Input
          id="crlv"
          name="crlv"
          type="file"
          accept={ACCEPT}
          required={!hasCrlv}
          disabled={pending}
        />
        <FieldDescription>
          O CRLV digital em PDF é o mais fácil de enviar.
        </FieldDescription>
      </Field>
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Não deu certo</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? (
          <>
            <Spinner /> Enviando…
          </>
        ) : (
          "Enviar documentos"
        )}
      </Button>
    </form>
  )
}
