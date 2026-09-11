import { describe, expect, it } from "vitest"

import { resolveOrgao } from "./orgao"

describe("resolveOrgao", () => {
  it("routes by órgão code", () => {
    expect(resolveOrgao({ code: "217610" })).toBe("STTU")
    expect(resolveOrgao({ code: "120100" })).toBe("DETRAN_RN")
  })

  it("prefers the code over the name", () => {
    expect(resolveOrgao({ code: "120100", name: "STTU" })).toBe("DETRAN_RN")
  })

  it("ignores punctuation in the code", () => {
    expect(resolveOrgao({ code: "217.610" })).toBe("STTU")
  })

  it("routes by name when the code is missing", () => {
    expect(
      resolveOrgao({ name: "Secretaria Municipal de Mobilidade Urbana - STTU" })
    ).toBe("STTU")
    expect(resolveOrgao({ name: "Prefeitura Municipal do Natal" })).toBe("STTU")
    expect(resolveOrgao({ name: "DETRAN/RN" })).toBe("DETRAN_RN")
    expect(
      resolveOrgao({ name: "Departamento Estadual de Trânsito do RN" })
    ).toBe("DETRAN_RN")
  })

  it("returns OTHER for federal or unknown issuers", () => {
    expect(
      resolveOrgao({ code: "100100", name: "Polícia Rodoviária Federal" })
    ).toBe("OTHER")
    expect(resolveOrgao({})).toBe("OTHER")
  })
})
