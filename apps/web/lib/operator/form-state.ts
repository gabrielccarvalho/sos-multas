export interface FormState {
  error: string | null
  done: boolean
}

export const emptyFormState: FormState = { error: null, done: false }
