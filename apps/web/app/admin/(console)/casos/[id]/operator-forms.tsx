"use client"

import { useActionState } from "react"

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
import {
  NativeSelect,
  NativeSelectOption,
} from "@workspace/ui/components/native-select"
import { Textarea } from "@workspace/ui/components/textarea"

import { emptyFormState, type FormState } from "@/lib/operator/form-state"
import { isTerminal, type CaseStatus } from "@/lib/domain/status"
import { cancel, correct, decide, fileCase, note, startReview } from "./actions"

type Action = (
  id: string,
  previous: FormState,
  formData: FormData
) => Promise<FormState>

function OperatorForm({
  id,
  action,
  title,
  submit,
  children,
}: {
  id: string
  action: Action
  title: string
  submit: string
  children?: React.ReactNode
}) {
  const [state, formAction, pending] = useActionState(
    action.bind(null, id),
    emptyFormState
  )
  return (
    <form action={formAction} className="flex flex-col gap-3 border-t pt-4">
      <h3 className="text-sm font-medium">{title}</h3>
      {children}
      {state.error ? (
        <Alert variant="destructive">
          <AlertTitle>Não deu certo</AlertTitle>
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <div>
        <Button type="submit" size="sm" disabled={pending}>
          {submit}
        </Button>
      </div>
    </form>
  )
}

export function OperatorActions({
  id,
  status,
}: {
  id: string
  status: CaseStatus
}) {
  const open = !isTerminal(status)
  return (
    <div className="flex flex-col gap-4">
      {status === "ready_to_file" ? (
        <OperatorForm
          id={id}
          action={fileCase}
          title="Protocolar"
          submit="Marcar como protocolado"
        >
          <Field>
            <FieldLabel htmlFor="protocolNumber">
              Número do protocolo
            </FieldLabel>
            <Input id="protocolNumber" name="protocolNumber" required />
          </Field>
          <Field>
            <FieldLabel htmlFor="receipt">Comprovante</FieldLabel>
            <Input
              id="receipt"
              name="receipt"
              type="file"
              accept="image/jpeg,image/png,application/pdf"
            />
            <FieldDescription>Opcional.</FieldDescription>
          </Field>
        </OperatorForm>
      ) : null}
      {status === "filed" ? (
        <OperatorForm
          id={id}
          action={startReview}
          title="Análise do órgão"
          submit="Marcar em análise"
        />
      ) : null}
      {status === "under_review" ? (
        <OperatorForm
          id={id}
          action={decide}
          title="Decisão"
          submit="Registrar decisão"
        >
          <Field>
            <FieldLabel htmlFor="outcome">Resultado</FieldLabel>
            <NativeSelect id="outcome" name="outcome" defaultValue="aceita">
              <NativeSelectOption value="aceita">
                Defesa aceita
              </NativeSelectOption>
              <NativeSelectOption value="negada">
                Defesa negada
              </NativeSelectOption>
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor="note">Observação para o cliente</FieldLabel>
            <Textarea id="note" name="note" rows={3} maxLength={1000} />
          </Field>
          <Field>
            <FieldLabel htmlFor="document">Decisão em PDF</FieldLabel>
            <Input
              id="document"
              name="document"
              type="file"
              accept="image/jpeg,image/png,application/pdf"
            />
          </Field>
        </OperatorForm>
      ) : null}
      {status === "ready_to_file" || status === "needs_signature" ? (
        <OperatorForm
          id={id}
          action={correct}
          title="Pedir correção"
          submit="Enviar pedido"
        >
          <Field>
            <FieldLabel htmlFor="message">
              O que o cliente precisa corrigir
            </FieldLabel>
            <Textarea id="message" name="message" rows={3} maxLength={1000} />
          </Field>
        </OperatorForm>
      ) : null}
      <OperatorForm
        id={id}
        action={note}
        title="Anotação para o cliente"
        submit="Adicionar ao histórico"
      >
        <Field>
          <FieldLabel htmlFor="noteMessage">Mensagem</FieldLabel>
          <Textarea id="noteMessage" name="message" rows={3} maxLength={1000} />
        </Field>
      </OperatorForm>
      {open ? (
        <OperatorForm
          id={id}
          action={cancel}
          title="Cancelar caso"
          submit="Cancelar caso"
        >
          <Field>
            <FieldLabel htmlFor="reason">Motivo</FieldLabel>
            <Input id="reason" name="reason" />
          </Field>
        </OperatorForm>
      ) : null}
    </div>
  )
}
