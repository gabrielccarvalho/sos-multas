import { describe, expect, it } from "vitest"

import {
  answerToValue,
  narrativeSchema,
  storyFormSchema,
} from "./story-form-schema"

const valid = {
  wasDriving: "sim",
  plateMatches: "sim",
  locationMatches: "nao",
  signageVisible: "nao_sei",
  details: "  Eu estava parado no semáforo.  ",
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
  ownerState: "rn",
  ownerCep: "59075-000",
  placaUf: "RN",
  consent: "on",
}

describe("storyFormSchema", () => {
  it("normalises the owner data and maps the answers", () => {
    const parsed = storyFormSchema.parse(valid)
    expect(parsed.owner.ownerCpf).toBe("52998224725")
    expect(parsed.owner.ownerPhone).toBe("84999998888")
    expect(parsed.owner.ownerCep).toBe("59075000")
    expect(parsed.owner.ownerState).toBe("RN")
    expect(parsed.owner.ownerCnhNumber).toBeNull()
    expect(parsed.owner.ownerAddressComplement).toBeNull()
    expect(parsed.narrative).toEqual({
      answers: {
        wasDriving: true,
        plateMatches: true,
        locationMatches: false,
        signageVisible: null,
      },
      details: "Eu estava parado no semáforo.",
    })
    expect(narrativeSchema.safeParse(parsed.narrative).success).toBe(true)
  })

  it("rejects an invalid CPF, e-mail, phone and CEP with pt-BR messages", () => {
    const result = storyFormSchema.safeParse({
      ...valid,
      ownerCpf: "111.111.111-11",
      ownerEmail: "maria",
      ownerPhone: "9999",
      ownerCep: "590",
    })
    expect(result.success).toBe(false)
    if (result.success) return
    const messages = result.error.issues.map((issue) => issue.message)
    expect(messages).toEqual(
      expect.arrayContaining([
        "CPF inválido.",
        "E-mail inválido.",
        "Telefone inválido. Inclua o DDD.",
        "CEP inválido.",
      ])
    )
  })

  it("requires the RG or the CNH number", () => {
    const result = storyFormSchema.safeParse({
      ...valid,
      ownerIdDocument: "",
      ownerCnhNumber: "",
    })
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.issues[0]?.path).toEqual(["ownerIdDocument"])
    expect(result.error.issues[0]?.message).toBe(
      "Informe o RG ou o número da CNH."
    )
    expect(
      storyFormSchema.safeParse({
        ...valid,
        ownerIdDocument: "",
        ownerCnhNumber: "01234567890",
      }).success
    ).toBe(true)
  })

  it("requires every question and the consent", () => {
    const result = storyFormSchema.safeParse({
      ...valid,
      wasDriving: undefined,
      consent: undefined,
    })
    expect(result.success).toBe(false)
    if (result.success) return
    const messages = result.error.issues.map((issue) => issue.message)
    expect(messages).toContain("Escolha uma opção.")
    expect(messages).toContain("Você precisa autorizar para continuar.")
  })

  it("maps stored answers back to form values", () => {
    expect(answerToValue(true)).toBe("sim")
    expect(answerToValue(false)).toBe("nao")
    expect(answerToValue(null)).toBe("nao_sei")
  })
})
