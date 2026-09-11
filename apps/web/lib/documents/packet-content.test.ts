import { describe, expect, it } from "vitest"

import type { Narrative } from "../cases/story-form-schema"
import {
  PacketNotReadyError,
  buildPacketContent,
  type PacketCase,
} from "./packet-content"
import {
  generatedAt,
  narrative,
  packetCase,
  testProcurador,
} from "./test-fixtures"

const build = (
  caseOverrides: Partial<PacketCase> = {},
  answers: Partial<Narrative["answers"]> = {},
  details = ""
) =>
  buildPacketContent({
    caseData: packetCase(caseOverrides),
    narrative: narrative(answers, details),
    procurador: testProcurador,
    today: generatedAt,
  })

const titles = (content: ReturnType<typeof build>) =>
  content.defesa.grounds.map((ground) => ground.title)

describe("buildPacketContent", () => {
  it("builds an STTU defesa da autuação", () => {
    const content = build()
    expect(content.title).toBe("DEFESA DA AUTUAÇÃO")
    expect(content.orgaoName).toBe(
      "Secretaria Municipal de Mobilidade Urbana de Natal – STTU"
    )
    expect(content.addressee).toBe(
      "À Autoridade de Trânsito da Secretaria Municipal de Mobilidade Urbana de Natal – STTU"
    )
    expect(content.assunto).toEqual({
      label: "RECURSO DE INFRAÇÃO - DEFESA PRÉVIA",
      defesaPrevia: true,
      jari: false,
      indicacao: false,
    })
    expect(content.place).toBe("Natal/RN")
    expect(content.dateLong).toBe("11 de setembro de 2026")
    expect(content.infraction).toEqual({
      aitNumber: "AE02024301",
      date: "01/08/2026",
      time: "14:32",
      location: "Av. Prudente de Morais, 1500 - Lagoa Nova - Natal/RN",
      code: "7587-0",
      description: "Avançar o sinal vermelho do semáforo",
    })
  })

  it("qualifies the requerente with formatted documents and address", () => {
    const content = build()
    expect(content.requerente.cpf).toBe("529.982.247-25")
    expect(content.requerente.phone).toBe("(84) 99999-8888")
    expect(content.requerente.addressLine).toBe(
      "Rua das Flores, 123, Apto 201, Lagoa Nova, Natal/RN, CEP 59075-000"
    )
    const { qualification } = content.defesa
    expect(qualification).toContain(
      "Maria da Silva, inscrito(a) no CPF sob o nº 529.982.247-25"
    )
    expect(qualification).toContain("placa ABC1D23/RN, RENAVAM 01234567890")
    expect(qualification).toContain(
      "Auto de Infração nº AE02024301, lavrado em 01/08/2026, às 14:32"
    )
    expect(qualification.endsWith("fundamentos a seguir expostos.")).toBe(true)
  })

  it("adds the general ground when only the equipment argument applies", () => {
    const content = build()
    expect(titles(content)).toEqual([
      "Aferição do equipamento",
      "Regularidade do auto de infração",
    ])
    expect(content.defesa.hasSpecificGrounds).toBe(false)
    expect(content.defesa.requests).toHaveLength(3)
    expect(content.defesa.requests[2]).toContain("certificado de verificação")
  })

  it("turns an owner who was not driving into an indicação", () => {
    const content = build({}, { wasDriving: false })
    expect(content.indicacao).toBe(true)
    expect(content.assunto.label).toBe("DEFESA E INDICAÇÃO")
    expect(content.defesa.hasSpecificGrounds).toBe(true)
    expect(content.defesa.requests.at(-1)).toContain(
      "indicação do condutor infrator"
    )
    expect(content.attachments).toContain("Cópia da CNH do condutor infrator")
  })

  it("flags a late NA by calendar date in Natal", () => {
    expect(titles(build({ issuedAt: "2026-09-01" }))[0]).toBe(
      "Notificação expedida fora do prazo"
    )
    expect(titles(build({ issuedAt: "2026-08-31" }))).not.toContain(
      "Notificação expedida fora do prazo"
    )
  })

  it("builds a DETRAN-RN recurso à JARI without an indicação", () => {
    const content = build(
      { orgao: "DETRAN_RN", stage: "NIP" },
      { wasDriving: false }
    )
    expect(content.title).toBe("RECURSO EM 1ª INSTÂNCIA")
    expect(content.addressee).toBe(
      "À Junta Administrativa de Recursos de Infrações – JARI do Departamento Estadual de Trânsito do Rio Grande do Norte – DETRAN/RN"
    )
    expect(content.assunto).toEqual({
      label: "Recurso à JARI",
      defesaPrevia: false,
      jari: true,
      indicacao: false,
    })
    expect(content.indicacao).toBe(false)
    expect(titles(content)).not.toContain("Indicação do condutor infrator")
    expect(content.defesa.requests[1]).toContain("cancelamento da penalidade")
  })

  it("uses the user's account as the facts, one paragraph per block", () => {
    expect(
      build(
        {},
        {},
        "Eu parei no sinal amarelo.\n\nO semáforo\nestava com defeito."
      ).defesa.facts
    ).toEqual(["Eu parei no sinal amarelo.", "O semáforo estava com defeito."])
    expect(build().defesa.facts).toHaveLength(1)
  })

  it("writes a procuração limited to this process", () => {
    const { text } = build().procuracao
    expect(text).toContain(
      "nomeia e constitui sua procuradora SOS Multas Serviços Ltda, inscrita no CNPJ sob o nº 12.345.678/0001-90"
    )
    expect(text).toContain(
      "perante a Secretaria Municipal de Mobilidade Urbana de Natal – STTU"
    )
    expect(text).toContain("Auto de Infração nº AE02024301")
    expect(text).toContain("vedado o substabelecimento")
  })

  it("defaults the plate UF to RN and omits missing optional data", () => {
    const content = build({
      placaUf: null,
      renavam: null,
      ownerCnhNumber: null,
      ownerAddressComplement: null,
    })
    expect(content.vehicle.placaUf).toBe("RN")
    expect(content.defesa.qualification).not.toContain("RENAVAM")
    expect(content.defesa.qualification).not.toContain("CNH")
    expect(content.requerente.addressLine).toBe(
      "Rua das Flores, 123, Lagoa Nova, Natal/RN, CEP 59075-000"
    )
  })

  it("refuses to build without the required data", () => {
    const attempt = () => build({ ownerName: null, ownerCep: null })
    expect(attempt).toThrow(PacketNotReadyError)
    try {
      attempt()
    } catch (error) {
      expect((error as PacketNotReadyError).missing).toEqual([
        "ownerName",
        "ownerCep",
      ])
    }
  })
})
