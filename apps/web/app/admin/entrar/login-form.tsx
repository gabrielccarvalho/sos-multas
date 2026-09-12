"use client"

import { useActionState } from "react"

import { Button } from "@workspace/ui/components/button"
import { Field, FieldError, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"

import { signIn } from "./actions"

export function LoginForm() {
  const [state, formAction, pending] = useActionState(signIn, { error: null })
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field data-invalid={state.error ? true : undefined}>
        <FieldLabel htmlFor="password">Senha do operador</FieldLabel>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        {state.error ? <FieldError>{state.error}</FieldError> : null}
      </Field>
      <Button type="submit" disabled={pending}>
        Entrar
      </Button>
    </form>
  )
}
