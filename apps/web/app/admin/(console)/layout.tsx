import Link from "next/link"

import { Button } from "@workspace/ui/components/button"

import { signOut } from "@/app/admin/entrar/actions"
import { requireOperator } from "@/lib/operator/auth"

export default async function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireOperator()
  return (
    <div className="mx-auto flex min-h-svh max-w-5xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between gap-4 border-b pb-4">
        <Link href="/admin" className="font-heading text-lg font-semibold">
          Console do operador
        </Link>
        <form action={signOut}>
          <Button type="submit" variant="ghost" size="sm">
            Sair
          </Button>
        </form>
      </header>
      {children}
    </div>
  )
}
