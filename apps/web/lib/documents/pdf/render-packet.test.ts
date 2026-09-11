import { extractText, getDocumentProxy } from "unpdf"
import { describe, expect, it } from "vitest"

import { buildPacketContent } from "../packet-content"
import {
  generatedAt,
  narrative,
  packetCase,
  testProcurador,
} from "../test-fixtures"
import { renderPacketPdf } from "./packet-document"

async function textOf(buffer: Buffer) {
  const pdf = await getDocumentProxy(new Uint8Array(buffer))
  return extractText(pdf, { mergePages: true })
}

describe("renderPacketPdf", () => {
  it("renders the STTU packet with the indicação page", async () => {
    const content = buildPacketContent({
      caseData: packetCase(),
      narrative: narrative({ wasDriving: false }),
      procurador: testProcurador,
      today: generatedAt,
    })
    const buffer = await renderPacketPdf(content)
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-")
    const { totalPages, text } = await textOf(buffer)
    expect(totalPages).toBeGreaterThanOrEqual(4)
    for (const expected of [
      "REQUERIMENTO STTU",
      "Directa online",
      "DEFESA DA AUTUAÇÃO",
      "PROCURAÇÃO",
      "FORMULÁRIO DE INDICAÇÃO DE CONDUTOR INFRATOR",
      "AE02024301",
      "529.982.247-25",
      "Natal/RN, 11 de setembro de 2026",
    ]) {
      expect(text).toContain(expected)
    }
  })

  it("renders a DETRAN-RN recurso without the indicação page", async () => {
    const content = buildPacketContent({
      caseData: packetCase({ orgao: "DETRAN_RN", stage: "NIP" }),
      narrative: narrative(),
      procurador: testProcurador,
      today: generatedAt,
    })
    const { text } = await textOf(await renderPacketPdf(content))
    expect(text).toContain("RECURSO EM 1ª INSTÂNCIA")
    expect(text).toContain("Recurso à JARI")
    expect(text).not.toContain("FORMULÁRIO DE INDICAÇÃO")
    expect(text).not.toContain("REQUERIMENTO STTU")
  })
})
