import { LoginForm } from "./login-form"

export default function Page() {
  return (
    <main className="mx-auto flex min-h-svh max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="font-heading text-2xl font-semibold">
        Console do operador
      </h1>
      <LoginForm />
    </main>
  )
}
