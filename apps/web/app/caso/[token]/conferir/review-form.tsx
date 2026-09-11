"use client"

import { useActionState } from "react"

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@workspace/ui/components/field"
import {
  NativeSelect,
  NativeSelectOption,
} from "@workspace/ui/components/native-select"
import { Spinner } from "@workspace/ui/components/spinner"

import { FormTextField } from "@/components/form-text-field"
import type { ConfirmState } from "@/lib/cases/confirm-case-data"
import type { Stage } from "@/lib/domain/stage"
import { confirmCaseData } from "./actions"

export const REVIEW_FIELDS = [
  "orgaoCode",
  "orgaoName",
  "aitNumber",
  "placa",
  "renavam",
  "infractionCode",
  "infractionDescription",
  "occurredAt",
  "location",
  "amountReais",
  "issuedAt",
  "deadlineDefense",
  "deadlineDriverIndication",
  "deadlineAppeal",
] as const

export type ReviewFieldName = (typeof REVIEW_FIELDS)[number]

export interface ReviewDefaults {
  stage: Stage
  values: Partial<Record<ReviewFieldName, string>>
  lowConfidence: ReviewFieldName[]
}

const initialState: ConfirmState = { errors: {}, message: null, values: null }

export function ReviewForm({
  token,
  defaults,
}: {
  token: string
  defaults: ReviewDefaults
}) {
  const [state, formAction, pending] = useActionState(
    confirmCaseData.bind(null, token),
    initialState
  )

  const field = (
    name: ReviewFieldName,
    label: string,
    options: {
      type?: "text" | "date" | "datetime-local"
      placeholder?: string
      description?: string
      required?: boolean
    } = {}
  ) => (
    <FormTextField
      name={name}
      label={label}
      defaultValue={state.values?.[name] ?? defaults.values[name] ?? ""}
      errors={state.errors[name]}
      badge={
        defaults.lowConfidence.includes(name) ? (
          <Badge variant="outline">Confira</Badge>
        ) : null
      }
      {...options}
    />
  )

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <FieldSet>
        <FieldLegend>Notificação</FieldLegend>
        <FieldGroup>
          <Field data-invalid={state.errors.stage ? true : undefined}>
            <FieldLabel htmlFor="stage">Tipo de notificação</FieldLabel>
            <NativeSelect
              id="stage"
              name="stage"
              defaultValue={state.values?.stage ?? defaults.stage}
            >
              <NativeSelectOption value="NA">
                Notificação de Autuação (primeira carta)
              </NativeSelectOption>
              <NativeSelectOption value="NIP">
                Notificação de Penalidade (com o valor da multa)
              </NativeSelectOption>
            </NativeSelect>
            {state.errors.stage ? (
              <FieldError>{state.errors.stage.join(" ")}</FieldError>
            ) : null}
          </Field>
          {field("orgaoCode", "Código do órgão autuador", {
            placeholder: "217610",
          })}
          {field("orgaoName", "Órgão autuador", {
            placeholder: "STTU ou DETRAN-RN",
          })}
          {field("aitNumber", "Número do auto de infração", {
            required: true,
          })}
        </FieldGroup>
      </FieldSet>

      <FieldSet>
        <FieldLegend>Veículo e infração</FieldLegend>
        <FieldGroup>
          {field("placa", "Placa", { placeholder: "ABC1D23", required: true })}
          {field("renavam", "RENAVAM", {
            description: "Só se estiver na carta.",
          })}
          {field("infractionCode", "Código da infração", {
            placeholder: "7587-0",
          })}
          {field("infractionDescription", "Descrição da infração")}
          {field("occurredAt", "Data e hora da infração", {
            type: "datetime-local",
            required: true,
          })}
          {field("location", "Local")}
          {field("amountReais", "Valor da multa (R$)", {
            placeholder: "130,16",
            description: "Deixe em branco se a carta não mostra valor.",
          })}
        </FieldGroup>
      </FieldSet>

      <FieldSet>
        <FieldLegend>Prazos</FieldLegend>
        <FieldDescription>
          Confira cada data na carta. Um prazo errado pode perder a defesa.
        </FieldDescription>
        <FieldGroup>
          {field("issuedAt", "Data de expedição", { type: "date" })}
          {field("deadlineDefense", "Data limite para defesa", {
            type: "date",
          })}
          {field(
            "deadlineDriverIndication",
            "Data limite para indicação do condutor",
            { type: "date" }
          )}
          {field("deadlineAppeal", "Data limite para recurso", {
            type: "date",
          })}
          <Field
            orientation="horizontal"
            data-invalid={state.errors.datesConfirmed ? true : undefined}
          >
            <Checkbox id="datesConfirmed" name="datesConfirmed" value="on" />
            <FieldLabel htmlFor="datesConfirmed">
              Conferi as datas com a notificação
            </FieldLabel>
          </Field>
          {state.errors.datesConfirmed ? (
            <FieldError>{state.errors.datesConfirmed.join(" ")}</FieldError>
          ) : null}
        </FieldGroup>
      </FieldSet>

      {state.message ? (
        <Alert variant="destructive">
          <AlertTitle>Ainda não</AlertTitle>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? (
          <>
            <Spinner /> Salvando…
          </>
        ) : (
          "Confirmar dados"
        )}
      </Button>
    </form>
  )
}
