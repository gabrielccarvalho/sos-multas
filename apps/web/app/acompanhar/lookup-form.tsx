"use client"

import Link from "next/link"
import { useActionState } from "react"

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"

import { FormTextField } from "@/components/form-text-field"
import type { LookupMatch } from "@/lib/cases/lookup-match"
import { findCase } from "./actions"

const initialState: { error: string | null; matches: LookupMatch[] } = {
  error: null,
  matches: [],
}

export function LookupForm() {
  const [state, formAction, pending] = useActionState(findCase, initialState)
  return (
    <form action={formAction} className="flex flex-col gap-6">
      <FormTextField
        name="cpf"
        label="CPF do proprietário"
        inputMode="numeric"
        placeholder="000.000.000-00"
        required
      />
      <FormTextField
        name="placa"
        label="Placa do veículo"
        placeholder="ABC1D23"
        required
      />
      {state.error ? (
        <Alert variant="destructive">
          <AlertTitle>Não encontramos</AlertTitle>
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      {state.matches.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm">Encontramos mais de um caso:</p>
          {state.matches.map((match) => (
            <Link
              key={match.token}
              href={`/caso/${match.token}`}
              className="text-sm underline underline-offset-4"
            >
              {match.aitNumber ?? "Caso"} · {match.statusLabel}
            </Link>
          ))}
        </div>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? (
          <>
            <Spinner /> Procurando…
          </>
        ) : (
          "Encontrar meu caso"
        )}
      </Button>
    </form>
  )
}
