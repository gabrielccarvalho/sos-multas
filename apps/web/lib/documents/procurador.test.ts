import { describe, expect, it } from "vitest"

import { procuradorFromEnv } from "./procurador"

describe("procuradorFromEnv", () => {
  it("reads the company identity", () => {
    expect(
      procuradorFromEnv({
        PROCURADOR_NAME: " SOS Multas Serviços Ltda ",
        PROCURADOR_CNPJ: "12.345.678/0001-90",
        PROCURADOR_ADDRESS: "Av. Senador Salgado Filho, 1000, Natal/RN",
        PROCURADOR_EMAIL: "",
        PROCURADOR_PHONE: "8430000000",
      })
    ).toEqual({
      name: "SOS Multas Serviços Ltda",
      cnpj: "12.345.678/0001-90",
      address: "Av. Senador Salgado Filho, 1000, Natal/RN",
      email: null,
      phone: "8430000000",
      configured: true,
    })
  })

  it("falls back to visible placeholders", () => {
    const procurador = procuradorFromEnv({})
    expect(procurador.configured).toBe(false)
    expect(procurador.name).toBe("[RAZÃO SOCIAL DO PROCURADOR]")
    expect(procurador.cnpj).toBe("[CNPJ DO PROCURADOR]")
  })
})
