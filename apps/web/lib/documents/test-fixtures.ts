import type { Narrative } from "../cases/story-form-schema"
import type { PacketCase } from "./packet-content"
import type { Procurador } from "./procurador"

export function packetCase(overrides: Partial<PacketCase> = {}): PacketCase {
  return {
    orgao: "STTU",
    stage: "NA",
    orgaoName: "STTU - Prefeitura do Natal",
    aitNumber: "AE02024301",
    placa: "ABC1D23",
    placaUf: "RN",
    renavam: "01234567890",
    infractionCode: "7587-0",
    infractionDescription: "Avançar o sinal vermelho do semáforo",
    occurredAt: new Date("2026-08-01T17:32:00Z"),
    location: "Av. Prudente de Morais, 1500 - Lagoa Nova - Natal/RN",
    issuedAt: "2026-08-20",
    ownerName: "Maria da Silva",
    ownerCpf: "52998224725",
    ownerIdDocument: "1.234.567 SSP/RN",
    ownerCnhNumber: "01234567890",
    ownerEmail: "maria@example.com",
    ownerPhone: "84999998888",
    ownerAddress: "Rua das Flores",
    ownerAddressNumber: "123",
    ownerAddressComplement: "Apto 201",
    ownerDistrict: "Lagoa Nova",
    ownerCity: "Natal",
    ownerState: "RN",
    ownerCep: "59075000",
    ...overrides,
  }
}

export function narrative(
  answers: Partial<Narrative["answers"]> = {},
  details = ""
): Narrative {
  return {
    answers: {
      wasDriving: true,
      plateMatches: true,
      locationMatches: true,
      signageVisible: true,
      ...answers,
    },
    details,
  }
}

export const testProcurador: Procurador = {
  name: "SOS Multas Serviços Ltda",
  cnpj: "12.345.678/0001-90",
  address: "Av. Senador Salgado Filho, 1000, Lagoa Nova, Natal/RN",
  email: "contato@sosmultas.com.br",
  phone: "8430000000",
  configured: true,
}

export const generatedAt = new Date("2026-09-11T15:00:00Z")
