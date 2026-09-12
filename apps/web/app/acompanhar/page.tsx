import { LookupForm } from "./lookup-form"

export default function Page() {
  return (
    <main className="mx-auto flex min-h-svh max-w-sm flex-col justify-center gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl font-semibold">
          Acompanhar meu caso
        </h1>
        <p className="text-sm text-muted-foreground">
          Informe o CPF do proprietário e a placa do veículo.
        </p>
      </div>
      <LookupForm />
    </main>
  )
}
