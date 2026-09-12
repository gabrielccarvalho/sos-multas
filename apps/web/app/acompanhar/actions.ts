"use server"

import { redirect } from "next/navigation"

import type { LookupMatch } from "@/lib/cases/lookup-match"
import { findCasesByOwner } from "@/lib/cases/repository"
import { isValidCpf, normalizeCpf } from "@/lib/domain/cpf"
import { STATUS_LABELS } from "@/lib/domain/status"

export async function findCase(
  _previous: { error: string | null; matches: LookupMatch[] },
  formData: FormData
): Promise<{ error: string | null; matches: LookupMatch[] }> {
  const cpf = normalizeCpf(String(formData.get("cpf") ?? ""))
  const placa = String(formData.get("placa") ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
  if (!isValidCpf(cpf)) {
    return { error: "CPF inválido.", matches: [] }
  }
  if (!/^[A-Z]{3}\d[A-Z0-9]\d{2}$/.test(placa)) {
    return { error: "Placa inválida.", matches: [] }
  }

  const found = await findCasesByOwner(cpf, placa)
  if (found.length === 0) {
    return {
      error:
        "Não encontramos um caso com esse CPF e essa placa. Confira os dados ou use o link que você recebeu ao enviar a multa.",
      matches: [],
    }
  }
  if (found.length === 1 && found[0]) redirect(`/caso/${found[0].token}`)
  return {
    error: null,
    matches: found.map((row) => ({
      token: row.token,
      aitNumber: row.aitNumber,
      statusLabel: STATUS_LABELS[row.status],
    })),
  }
}
