import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"

export function FormTextField({
  name,
  label,
  errors,
  badge,
  description,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "id" | "name"> & {
  name: string
  label: string
  errors?: string[]
  badge?: React.ReactNode
  description?: string
}) {
  const invalid = errors?.length ? true : undefined
  return (
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor={name}>
        {label}
        {badge}
      </FieldLabel>
      <Input id={name} name={name} aria-invalid={invalid} {...props} />
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      {errors?.length ? <FieldError>{errors.join(" ")}</FieldError> : null}
    </Field>
  )
}
