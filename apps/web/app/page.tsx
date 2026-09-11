import { ButtonLink } from "@/components/button-link"

export default function Page() {
  return (
    <main className="mx-auto flex min-h-svh max-w-xl flex-col justify-center gap-6 p-6">
      <h1 className="font-heading text-3xl font-semibold">
        Recebeu uma multa em Natal?
      </h1>
      <p className="text-muted-foreground">
        Envie a notificação e a gente cuida da defesa junto à STTU ou ao
        DETRAN-RN, com você acompanhando cada passo.
      </p>
      <div>
        <ButtonLink href="/nova" size="lg">
          Enviar minha multa
        </ButtonLink>
      </div>
    </main>
  )
}
