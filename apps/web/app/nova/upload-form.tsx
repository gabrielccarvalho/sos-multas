"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Spinner } from "@workspace/ui/components/spinner"

export function UploadForm() {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const body = new FormData(event.currentTarget)
    setPending(true)
    setError(null)
    const response = await fetch("/api/casos", { method: "POST", body })
    const data = (await response.json()) as { token?: string; error?: string }
    if (!response.ok || !data.token) {
      setError(data.error ?? "Não foi possível enviar. Tente de novo.")
      setPending(false)
      return
    }
    router.push(`/caso/${data.token}/conferir`)
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <Field>
        <FieldLabel htmlFor="notification">
          Foto, PDF ou captura de tela da notificação
        </FieldLabel>
        <Input
          id="notification"
          name="notification"
          type="file"
          accept="image/jpeg,image/png,application/pdf"
          required
          disabled={pending}
        />
        <FieldDescription>
          Aceitamos JPG, PNG ou PDF de até 10 MB. Uma captura de tela do app
          Carteira Digital de Trânsito também serve.
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
            <Spinner /> Lendo a notificação…
          </>
        ) : (
          "Enviar notificação"
        )}
      </Button>
    </form>
  )
}
