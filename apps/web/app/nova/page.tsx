import { UploadForm } from "./upload-form"

export default function Page() {
  return (
    <main className="mx-auto flex min-h-svh max-w-xl flex-col gap-8 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl font-semibold">
          Envie a sua multa
        </h1>
        <p className="text-sm text-muted-foreground">
          Vamos ler a notificação, conferir os prazos e preparar a defesa. Você
          confirma cada dado antes de seguir.
        </p>
      </div>
      <UploadForm />
    </main>
  )
}
