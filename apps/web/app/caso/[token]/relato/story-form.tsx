"use client"

import { useActionState } from "react"

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
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
  RadioGroup,
  RadioGroupItem,
} from "@workspace/ui/components/radio-group"
import { Spinner } from "@workspace/ui/components/spinner"
import { Textarea } from "@workspace/ui/components/textarea"

import { FormTextField } from "@/components/form-text-field"
import { CONSENT_TEXT, type AnswerValue } from "@/lib/cases/story-form-schema"
import type { StoryState } from "@/lib/cases/submit-story"
import { submitStory } from "./actions"

const QUESTIONS = [
  {
    name: "wasDriving",
    label: "Era você quem dirigia o veículo no momento da infração?",
  },
  {
    name: "plateMatches",
    label:
      "A placa, a marca e o modelo na notificação são mesmo do seu veículo?",
  },
  {
    name: "locationMatches",
    label: "O local, a data e a hora informados batem com o que aconteceu?",
  },
  {
    name: "signageVisible",
    label:
      "Havia sinalização visível e em bom estado no local (placas, faixas, semáforo funcionando)?",
  },
] as const

export type QuestionName = (typeof QUESTIONS)[number]["name"]

const OPTIONS: { value: AnswerValue; label: string }[] = [
  { value: "sim", label: "Sim" },
  { value: "nao", label: "Não" },
  { value: "nao_sei", label: "Não sei" },
]

export type StoryTextField =
  | "details"
  | "ownerName"
  | "ownerCpf"
  | "ownerIdDocument"
  | "ownerCnhNumber"
  | "ownerEmail"
  | "ownerPhone"
  | "ownerAddress"
  | "ownerAddressNumber"
  | "ownerAddressComplement"
  | "ownerDistrict"
  | "ownerCity"
  | "ownerState"
  | "ownerCep"
  | "placaUf"

export interface StoryDefaults {
  answers: Partial<Record<QuestionName, AnswerValue>>
  values: Partial<Record<StoryTextField, string>>
}

const initialState: StoryState = { errors: {}, message: null, values: null }

export function StoryForm({
  token,
  defaults,
}: {
  token: string
  defaults: StoryDefaults
}) {
  const [state, formAction, pending] = useActionState(
    submitStory.bind(null, token),
    initialState
  )
  const value = (name: StoryTextField) =>
    state.values?.[name] ?? defaults.values[name] ?? ""
  const text = (
    name: StoryTextField,
    label: string,
    props: Omit<
      React.ComponentProps<typeof FormTextField>,
      "name" | "label"
    > = {}
  ) => (
    <FormTextField
      name={name}
      label={label}
      defaultValue={value(name)}
      errors={state.errors[name]}
      {...props}
    />
  )

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <FieldSet>
        <FieldLegend>O que aconteceu</FieldLegend>
        <FieldGroup>
          {QUESTIONS.map((question) => {
            const errors = state.errors[question.name]
            return (
              <Field
                key={question.name}
                data-invalid={errors ? true : undefined}
              >
                <FieldLabel>{question.label}</FieldLabel>
                <RadioGroup
                  name={question.name}
                  defaultValue={
                    state.values?.[question.name] ??
                    defaults.answers[question.name]
                  }
                  className="flex flex-wrap gap-6"
                >
                  {OPTIONS.map((option) => {
                    const id = `${question.name}-${option.value}`
                    return (
                      <Field
                        key={option.value}
                        orientation="horizontal"
                        className="w-auto"
                      >
                        <RadioGroupItem id={id} value={option.value} />
                        <FieldLabel htmlFor={id} className="font-normal">
                          {option.label}
                        </FieldLabel>
                      </Field>
                    )
                  })}
                </RadioGroup>
                {errors ? <FieldError>{errors.join(" ")}</FieldError> : null}
              </Field>
            )
          })}
          <Field data-invalid={state.errors.details ? true : undefined}>
            <FieldLabel htmlFor="details">
              Quer contar mais alguma coisa?
            </FieldLabel>
            <Textarea
              id="details"
              name="details"
              rows={5}
              maxLength={2000}
              defaultValue={value("details")}
              placeholder="Ex.: o semáforo estava apagado, eu não estava em Natal nesse dia, o carro já tinha sido vendido."
            />
            <FieldDescription>
              Escreva com suas palavras. Usamos isso na parte dos fatos da
              defesa.
            </FieldDescription>
            {state.errors.details ? (
              <FieldError>{state.errors.details.join(" ")}</FieldError>
            ) : null}
          </Field>
        </FieldGroup>
      </FieldSet>

      <FieldSet>
        <FieldLegend>Dados do proprietário do veículo</FieldLegend>
        <FieldDescription>
          Vão no requerimento. Precisam ser os dados de quem vai assinar.
        </FieldDescription>
        <FieldGroup>
          {text("ownerName", "Nome completo", {
            required: true,
            autoComplete: "name",
          })}
          <div className="grid gap-4 sm:grid-cols-2">
            {text("ownerCpf", "CPF", {
              required: true,
              inputMode: "numeric",
              placeholder: "000.000.000-00",
            })}
            {text("ownerIdDocument", "RG e órgão emissor", {
              placeholder: "1.234.567 SSP/RN",
            })}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {text("ownerCnhNumber", "Número de registro da CNH", {
              inputMode: "numeric",
              description: "Informe o RG, a CNH ou os dois.",
            })}
            {text("ownerPhone", "Telefone com DDD", {
              required: true,
              inputMode: "tel",
              autoComplete: "tel",
            })}
          </div>
          {text("ownerEmail", "E-mail", {
            type: "email",
            required: true,
            autoComplete: "email",
          })}
        </FieldGroup>
      </FieldSet>

      <FieldSet>
        <FieldLegend>Endereço</FieldLegend>
        <FieldGroup>
          <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
            {text("ownerAddress", "Logradouro", {
              required: true,
              autoComplete: "address-line1",
            })}
            {text("ownerAddressNumber", "Número", { required: true })}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {text("ownerAddressComplement", "Complemento")}
            {text("ownerDistrict", "Bairro", { required: true })}
          </div>
          <div className="grid gap-4 sm:grid-cols-[1fr_5rem_9rem]">
            {text("ownerCity", "Cidade", { required: true })}
            {text("ownerState", "UF", { required: true, maxLength: 2 })}
            {text("ownerCep", "CEP", {
              required: true,
              inputMode: "numeric",
              autoComplete: "postal-code",
            })}
          </div>
          {text("placaUf", "UF da placa do veículo", {
            required: true,
            maxLength: 2,
            className: "w-24",
          })}
        </FieldGroup>
      </FieldSet>

      <Field
        orientation="horizontal"
        data-invalid={state.errors.consent ? true : undefined}
      >
        <Checkbox
          id="consent"
          name="consent"
          value="on"
          defaultChecked={state.values?.consent === "on"}
        />
        <FieldLabel htmlFor="consent" className="leading-snug font-normal">
          {CONSENT_TEXT}
        </FieldLabel>
      </Field>
      {state.errors.consent ? (
        <FieldError>{state.errors.consent.join(" ")}</FieldError>
      ) : null}

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
          "Salvar e continuar"
        )}
      </Button>
    </form>
  )
}
