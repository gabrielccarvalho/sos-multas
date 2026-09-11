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

export function SignedForm({ token }: { token: string }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)
    const response = await fetch(`/api/casos/${token}/assinados`, {
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
        <FieldLabel htmlFor="signed">Páginas assinadas</FieldLabel>
        <Input
          id="signed"
          name="signed"
          type="file"
          multiple
          accept="image/jpeg,image/png,application/pdf"
          required
          disabled={pending}
        />
        <FieldDescription>
          Até 10 arquivos: uma foto de cada página ou um PDF com todas.
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
          "Enviar páginas assinadas"
        )}
      </Button>
    </form>
  )
}
