import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

import type { CaseRow } from "../db/schema"
import { generatedAt, testProcurador } from "../documents/test-fixtures"
import { LocalDiskStorage } from "../storage"
import type { PacketDeps } from "./generate-packet"
import {
  createCase,
  transitionCase,
  updateCaseData,
  type CaseDataUpdate,
} from "./repository"

export async function createConfirmedCase(
  overrides: CaseDataUpdate = {}
): Promise<CaseRow> {
  const created = await createCase()
  await transitionCase(created.id, "needs_review", {
    type: "case.extracted",
    messagePt: "Lemos os dados.",
    actor: "system",
  })
  await updateCaseData(created.id, {
    orgao: "STTU",
    stage: "NA",
    orgaoCode: "217610",
    orgaoName: "STTU",
    aitNumber: "AE02024301",
    placa: "ABC1D23",
    infractionCode: "7587-0",
    infractionDescription: "Avançar o sinal vermelho do semáforo",
    occurredAt: new Date("2026-08-01T17:32:00Z"),
    location: "Av. Prudente de Morais, 1500",
    issuedAt: "2026-08-20",
    deadlineDefense: "2026-09-21",
    deadlineDriverIndication: "2026-09-21",
    ...overrides,
  })
  return transitionCase(created.id, "needs_documents", {
    type: "case.data_confirmed",
    messagePt: "Dados confirmados.",
    actor: "user",
  })
}

export function storyForm(overrides: Record<string, string> = {}): FormData {
  const fields: Record<string, string> = {
    wasDriving: "sim",
    plateMatches: "sim",
    locationMatches: "sim",
    signageVisible: "nao",
    details: "O semáforo estava apagado.",
    ownerName: "Maria da Silva",
    ownerCpf: "529.982.247-25",
    ownerIdDocument: "1.234.567 SSP/RN",
    ownerCnhNumber: "",
    ownerEmail: "maria@example.com",
    ownerPhone: "(84) 99999-8888",
    ownerAddress: "Rua das Flores",
    ownerAddressNumber: "123",
    ownerAddressComplement: "",
    ownerDistrict: "Lagoa Nova",
    ownerCity: "Natal",
    ownerState: "RN",
    ownerCep: "59075-000",
    placaUf: "RN",
    consent: "on",
    ...overrides,
  }
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) data.set(key, value)
  return data
}

export function fakeUpload(name: string, type = "image/png"): File {
  return new File(["fake image bytes"], name, { type })
}

export async function tempPacketDeps(): Promise<
  PacketDeps & { cleanup: () => Promise<void> }
> {
  const root = await mkdtemp(path.join(tmpdir(), "sos-multas-cases-"))
  return {
    storage: new LocalDiskStorage(root),
    procurador: testProcurador,
    now: () => generatedAt,
    cleanup: () => rm(root, { recursive: true, force: true }),
  }
}
